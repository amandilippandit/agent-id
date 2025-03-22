import {
  generateKeypair,
  getPublicKey,
  toBase64Url,
  fromBase64Url,
  fingerprint,
  sign,
  verify,
} from "./crypto.js";
import { savePrivateKey, loadPrivateKey, deletePrivateKey, listStoredKeys, listAgentNames, getOrCreateDefaultName } from "./storage.js";
import { signRequest, createSignedHeaders, type SignedHeaders } from "./signing.js";

// ── Public Registry ─────────────────────────────────────────────

const DEFAULT_REGISTRY = "https://agent-id.cognition.dev";

// ── Types ───────────────────────────────────────────────────────

export interface AgentIDOptions {
  /** Display name for this agent. Each name gets its own unique identity.
   *  Same name = same identity. New name = new identity.
   *  If omitted, auto-derives from your project directory. */
  name?: string;
  /** LLM model this agent uses (unverified, self-declared) */
  model?: string;
  /** Runtime environment */
  runtime?: string;
  /** Custom registry URL (defaults to public registry) */
  registry?: string;
  /** Custom key storage path (defaults to ~/.agent-id/keys/) */
  storagePath?: string;
}

export interface AgentProfile {
  agent_id: string;
  public_key: string;
  status: "active" | "revoked";
  created_at: number;
  metadata: {
    name?: string;
    runtime?: string;
    model?: string;
  };
}

// ── AgentID ─────────────────────────────────────────────────────

export class AgentID {
  /** The agent's unique, permanent identifier (SHA-256 of public key) */
  readonly id: string;
  /** The agent's display name */
  readonly name: string;
  /** The agent's Ed25519 public key (base64url) */
  readonly publicKey: string;

  private readonly _privateKey: Uint8Array;
  private readonly _publicKeyBytes: Uint8Array;
  private readonly _registry: string;
  private readonly _name: string;
  private readonly _storagePath?: string;

  private constructor(
    id: string,
    name: string,
    publicKeyBytes: Uint8Array,
    privateKey: Uint8Array,
    registry: string,
    storagePath?: string,
  ) {
    this.id = id;
    this.name = name;
    this._name = name;
    this._publicKeyBytes = publicKeyBytes;
    this.publicKey = toBase64Url(publicKeyBytes);
    this._privateKey = privateKey;
    this._registry = registry;
    this._storagePath = storagePath;
  }

  // ── Init (the only thing most people need) ──────────────────

  /**
   * Create or load an agent identity. Each name gets its own unique identity.
   *
   * ```ts
   * import { AgentID } from 'nacht-id'
   *
   * const agent = await AgentID.init({ name: 'my-agent' })
   * // First run  → generates new identity, registers it
   * // Next runs  → loads the same identity from disk
   *
   * const other = await AgentID.init({ name: 'other-agent' })
   * // Different name → completely different identity
   * ```
   */
  static async init(options: AgentIDOptions = {}): Promise<AgentID> {
    const registry = options.registry ?? DEFAULT_REGISTRY;
    const storagePath = options.storagePath;
    const runtime = options.runtime ?? detectRuntime();
    const name = options.name ?? autoName(storagePath);

    // Check for existing identity for this name
    const existingIds = listStoredKeys(name, storagePath);
    if (existingIds.length > 0) {
      const id = existingIds[0];
      const privateKey = loadPrivateKey(id, name, storagePath);
      if (privateKey) {
        const publicKeyBytes = getPublicKey(privateKey);
        return new AgentID(id, name, publicKeyBytes, privateKey, registry, storagePath);
      }
    }

    // Generate new keypair
    const { privateKey, publicKey } = generateKeypair();
    const id = await fingerprint(publicKey);
    const publicKeyB64 = toBase64Url(publicKey);

    // Get nonce
    const nonceRes = await fetch(`${registry}/api/register/nonce`);
    if (!nonceRes.ok) throw new Error(`Registry unreachable at ${registry}`);
    const { nonce } = (await nonceRes.json()) as { nonce: string };

    // Sign nonce as proof-of-possession
    const proof = sign(new TextEncoder().encode(nonce), privateKey);

    // Register
    const res = await fetch(`${registry}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        public_key: publicKeyB64,
        proof: toBase64Url(proof),
        nonce,
        metadata: {
          name,
          runtime,
          model: options.model,
        },
      }),
    });

    if (!res.ok) {
      const err = (await res.json()) as { error: string };
      throw new Error(`Registration failed: ${err.error}`);
    }

    // Save key to disk under this agent's name
    savePrivateKey(id, privateKey, name, storagePath);

    return new AgentID(id, name, publicKey, privateKey, registry, storagePath);
  }

  // ── Load a specific identity ────────────────────────────────

  /**
   * Load an existing identity by agent name. Returns null if not found.
   */
  static async load(
    name: string,
    options: { registry?: string; storagePath?: string } = {},
  ): Promise<AgentID | null> {
    const existingIds = listStoredKeys(name, options.storagePath);
    if (existingIds.length === 0) return null;
    const id = existingIds[0];
    const privateKey = loadPrivateKey(id, name, options.storagePath);
    if (!privateKey) return null;
    const publicKeyBytes = getPublicKey(privateKey);
    return new AgentID(
      id,
      name,
      publicKeyBytes,
      privateKey,
      options.registry ?? DEFAULT_REGISTRY,
      options.storagePath,
    );
  }

  // ── Signing ─────────────────────────────────────────────────

  /**
   * Sign an HTTP request. Adds X-Agent-ID, X-Agent-Signature, X-Agent-Timestamp headers.
   *
   * ```ts
   * const req = new Request('https://api.example.com/data')
   * const signed = await agent.signRequest(req)
   * const res = await fetch(signed)
   * ```
   */
  async signRequest(request: Request): Promise<Request> {
    return signRequest(request, this.id, this._privateKey);
  }

  /**
   * Get signed headers for a given method + path. Use this with any HTTP client.
   *
   * ```ts
   * const headers = agent.signHeaders('POST', '/api/data')
   * await axios.post('/api/data', body, { headers })
   * ```
   */
  signHeaders(method: string, path: string): SignedHeaders {
    return createSignedHeaders(this.id, this._privateKey, method, path);
  }

  /**
   * Sign arbitrary data.
   */
  async sign(data: Uint8Array): Promise<Uint8Array> {
    return sign(data, this._privateKey);
  }

  // ── Identity management ─────────────────────────────────────

  /**
   * Get this agent's public profile from the registry.
   */
  async profile(): Promise<AgentProfile> {
    const res = await fetch(`${this._registry}/api/agent/${this.id}`);
    if (!res.ok) throw new Error("Agent not found on registry");
    return res.json() as Promise<AgentProfile>;
  }

  /**
   * Update agent metadata (name, model, runtime).
   */
  async update(metadata: { name?: string; model?: string; runtime?: string }): Promise<void> {
    const timestamp = Date.now();
    const message = `METADATA:${this.id}:${timestamp}`;
    const proof = sign(new TextEncoder().encode(message), this._privateKey);

    const res = await fetch(`${this._registry}/api/agent/${this.id}/metadata`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metadata,
        proof: toBase64Url(proof),
        timestamp,
      }),
    });

    if (!res.ok) {
      const err = (await res.json()) as { error: string };
      throw new Error(`Update failed: ${err.error}`);
    }
  }

  /**
   * Permanently revoke this identity. Cannot be undone.
   */
  async revoke(): Promise<void> {
    const timestamp = Date.now();
    const message = `REVOKE:${this.id}:${timestamp}`;
    const proof = sign(new TextEncoder().encode(message), this._privateKey);

    const res = await fetch(`${this._registry}/api/agent/${this.id}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proof: toBase64Url(proof),
        timestamp,
      }),
    });

    if (!res.ok) {
      const err = (await res.json()) as { error: string };
      throw new Error(`Revocation failed: ${err.error}`);
    }

    deletePrivateKey(this.id, this._name, this._storagePath);
  }

  // ── Static verification (for receiving services) ────────────

  /**
   * Verify a signature from any agent. Use this on the receiving side.
   *
   * ```ts
   * const result = await AgentID.verify({
   *   agentId: req.headers['x-agent-id'],
   *   signature: req.headers['x-agent-signature'],
   *   message: `${req.method} ${req.path} ${req.headers['x-agent-timestamp']}`,
   * })
   * ```
   */
  static async verify(params: {
    agentId: string;
    message: string | Uint8Array;
    signature: string | Uint8Array;
    registry?: string;
  }): Promise<{ valid: boolean; status: "active" | "revoked" }> {
    const registry = params.registry ?? DEFAULT_REGISTRY;
    const messageB64 =
      typeof params.message === "string"
        ? toBase64Url(new TextEncoder().encode(params.message))
        : toBase64Url(params.message);
    const signatureB64 =
      typeof params.signature === "string" ? params.signature : toBase64Url(params.signature);

    const res = await fetch(`${registry}/api/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: params.agentId,
        message: messageB64,
        signature: signatureB64,
      }),
    });

    const data = (await res.json()) as { valid: boolean; status: "active" | "revoked" };
    return { valid: data.valid ?? false, status: data.status };
  }

  // ── Helpers ─────────────────────────────────────────────────

  toString(): string {
    return `AgentID<${this.name}>(${this.id.slice(0, 12)}...)`;
  }

  toJSON() {
    return { agent_id: this.id, name: this.name, public_key: this.publicKey };
  }
}

// ── Auto name from project directory ────────────────────────────

function autoName(storagePath?: string): string {
  try {
    // 1. Try script filename: code-reviewer.ts → "code-reviewer"
    const entry = process.argv[1];
    if (entry) {
      const filename = entry.split("/").pop()?.split("\\").pop() ?? "";
      const name = filename.replace(/\.(ts|js|mjs|cjs|tsx|jsx)$/, "");
      if (name && name !== "index" && name !== "main" && name !== "bun") return name;
    }
    // 2. Fallback: generate a persistent random name (saved to ~/.agent-id/keys/.default)
    return getOrCreateDefaultName(storagePath);
  } catch {
    return `agent-${Date.now()}`;
  }
}

// ── Runtime detection ───────────────────────────────────────────

function detectRuntime(): string {
  if (typeof globalThis !== "undefined" && "Bun" in globalThis) return "bun";
  if (typeof globalThis !== "undefined" && "Deno" in globalThis) return "deno";
  if (typeof process !== "undefined" && process.versions?.node) return "node";
  return "unknown";
}

// ── Shorthand ───────────────────────────────────────────────────

/**
 * The simplest way to get an identity.
 *
 * ```ts
 * import { id } from 'nacht-id'
 *
 * const me = await id('my-agent')
 * me.id  // unique cryptographic identity
 *
 * // Or pass an object — uses name/role/type as identity
 * const agent = await id({ role: 'researcher', model: 'claude' })
 * agent.id
 * ```
 */
export function id(nameOrObj?: string | Record<string, any>, options?: { registry?: string; storagePath?: string }): Promise<AgentID> {
  if (!nameOrObj) return AgentID.init(options);
  if (typeof nameOrObj === "string") return AgentID.init({ name: nameOrObj, ...options });
  const name = nameOrObj.name ?? nameOrObj.role ?? nameOrObj.id ?? nameOrObj.type ?? nameOrObj.label;
  return AgentID.init({ name: name ? String(name) : undefined, model: nameOrObj.model, ...options });
}

// Re-export types
export type { SignedHeaders } from "./signing.js";

// Default export for convenience
export default AgentID;
