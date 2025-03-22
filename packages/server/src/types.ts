// ── Agent Identity ──────────────────────────────────────────────

export interface AgentIdentity {
  agent_id: string; // SHA-256 fingerprint of public key (64 hex chars)
  public_key: string; // base64url Ed25519 public key
  status: "active" | "revoked";
  created_at: number; // unix ms
  metadata: AgentMetadata;
}

export interface AgentMetadata {
  name?: string; // self-declared display name
  runtime?: string; // "bun", "node", etc.
  model?: string; // "claude-sonnet-4", "gpt-4o" (unverified)
}

// ── Registration ────────────────────────────────────────────────

export interface NonceRecord {
  nonce: string;
  created_at: number;
  used: boolean;
}

export interface RegisterRequest {
  public_key: string; // base64url Ed25519 public key
  proof: string; // base64url signature of nonce
  nonce: string;
  metadata?: AgentMetadata;
}

export interface RegisterResponse {
  agent_id: string;
  public_key: string;
  status: "active";
  created_at: number;
}

// ── Verification ────────────────────────────────────────────────

export interface VerifyRequest {
  agent_id: string;
  message: string; // base64url encoded message
  signature: string; // base64url encoded signature
}

export interface VerifyResponse {
  valid: boolean;
  agent_id: string;
  status: "active" | "revoked";
}

// ── Revocation ──────────────────────────────────────────────────

export interface RevokeRequest {
  proof: string; // base64url signature of "REVOKE:{agent_id}:{timestamp}"
  timestamp: number;
}

// ── Metadata Update ─────────────────────────────────────────────

export interface MetadataUpdateRequest {
  metadata: AgentMetadata;
  proof: string; // base64url signature of "METADATA:{agent_id}:{timestamp}"
  timestamp: number;
}

// ── Store Interface ─────────────────────────────────────────────

export interface Store {
  getAgent(agentId: string): Promise<AgentIdentity | null>;
  putAgent(agent: AgentIdentity): Promise<void>;
  getAgentByPublicKey(publicKey: string): Promise<string | null>;
  putPublicKeyMapping(publicKey: string, agentId: string): Promise<void>;
  getNonce(nonce: string): Promise<NonceRecord | null>;
  putNonce(record: NonceRecord): Promise<void>;
  deleteNonce(nonce: string): Promise<void>;
  listAgents(limit?: number): Promise<AgentIdentity[]>;
}

// ── Cloudflare Bindings ─────────────────────────────────────────

export interface Env {
  AGENT_KV: KVNamespace;
}
