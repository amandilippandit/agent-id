import { Hono } from "hono";
import { cors } from "hono/cors";
import type {
  Env,
  MetadataUpdateRequest,
  RegisterRequest,
  RevokeRequest,
  VerifyRequest,
} from "./types.js";
import { fromBase64Url, generateNonce, fingerprint, verify } from "./crypto.js";
import { getStore } from "./store.js";
import { LandingPage } from "./page.js";

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors());

// ── Landing Page ────────────────────────────────────────────────

app.get("/", (c) => c.html(<LandingPage />));

// ── Get Registration Nonce ──────────────────────────────────────

app.get("/api/register/nonce", async (c) => {
  const store = getStore(c.env);
  const nonce = generateNonce();
  await store.putNonce({ nonce, created_at: Date.now(), used: false });
  return c.json({ nonce });
});

// ── Register Agent ──────────────────────────────────────────────

app.post("/api/register", async (c) => {
  const store = getStore(c.env);
  const body = await c.req.json<RegisterRequest>();

  if (!body.public_key || !body.proof || !body.nonce) {
    return c.json({ error: "Missing required fields: public_key, proof, nonce" }, 400);
  }

  // Validate nonce
  const nonceRecord = await store.getNonce(body.nonce);
  if (!nonceRecord) {
    return c.json({ error: "Invalid or expired nonce" }, 400);
  }
  if (nonceRecord.used) {
    return c.json({ error: "Nonce already used" }, 400);
  }

  // Decode public key and proof
  let publicKeyBytes: Uint8Array;
  let proofBytes: Uint8Array;
  try {
    publicKeyBytes = fromBase64Url(body.public_key);
    proofBytes = fromBase64Url(body.proof);
  } catch {
    return c.json({ error: "Invalid base64url encoding" }, 400);
  }

  if (publicKeyBytes.length !== 32) {
    return c.json({ error: "Invalid Ed25519 public key (must be 32 bytes)" }, 400);
  }

  // Verify proof-of-possession: signature of the nonce
  const nonceBytes = new TextEncoder().encode(body.nonce);
  const valid = verify(proofBytes, nonceBytes, publicKeyBytes);
  if (!valid) {
    return c.json({ error: "Invalid proof-of-possession" }, 403);
  }

  // Check for duplicate public key
  const existing = await store.getAgentByPublicKey(body.public_key);
  if (existing) {
    return c.json({ error: "Public key already registered", agent_id: existing }, 409);
  }

  // Create identity
  const agentId = await fingerprint(publicKeyBytes);
  const now = Date.now();
  const agent = {
    agent_id: agentId,
    public_key: body.public_key,
    status: "active" as const,
    created_at: now,
    metadata: body.metadata ?? {},
  };

  await store.putAgent(agent);
  await store.putPublicKeyMapping(body.public_key, agentId);
  await store.deleteNonce(body.nonce);

  return c.json(
    {
      agent_id: agent.agent_id,
      public_key: agent.public_key,
      status: agent.status,
      created_at: agent.created_at,
    },
    201,
  );
});

// ── Get Agent Profile ───────────────────────────────────────────

app.get("/api/agent/:id", async (c) => {
  const store = getStore(c.env);
  const agent = await store.getAgent(c.req.param("id"));
  if (!agent) return c.json({ error: "Agent not found" }, 404);
  return c.json(agent);
});

// ── Verify Signature ────────────────────────────────────────────

app.post("/api/verify", async (c) => {
  const store = getStore(c.env);
  const body = await c.req.json<VerifyRequest>();

  if (!body.agent_id || !body.message || !body.signature) {
    return c.json({ error: "Missing required fields: agent_id, message, signature" }, 400);
  }

  const agent = await store.getAgent(body.agent_id);
  if (!agent) return c.json({ valid: false, error: "Agent not found" }, 404);

  try {
    const publicKeyBytes = fromBase64Url(agent.public_key);
    const messageBytes = fromBase64Url(body.message);
    const signatureBytes = fromBase64Url(body.signature);

    const valid = verify(signatureBytes, messageBytes, publicKeyBytes);
    return c.json({ valid, agent_id: agent.agent_id, status: agent.status });
  } catch {
    return c.json({ valid: false, agent_id: agent.agent_id, status: agent.status });
  }
});

// ── Revoke Identity ─────────────────────────────────────────────

app.post("/api/agent/:id/revoke", async (c) => {
  const store = getStore(c.env);
  const agentId = c.req.param("id");
  const body = await c.req.json<RevokeRequest>();

  if (!body.proof || !body.timestamp) {
    return c.json({ error: "Missing required fields: proof, timestamp" }, 400);
  }

  // Timestamp must be within 5 minutes
  if (Math.abs(Date.now() - body.timestamp) > 5 * 60 * 1000) {
    return c.json({ error: "Timestamp out of range (±5 min)" }, 400);
  }

  const agent = await store.getAgent(agentId);
  if (!agent) return c.json({ error: "Agent not found" }, 404);
  if (agent.status === "revoked") return c.json({ error: "Already revoked" }, 400);

  // Verify revocation proof
  const message = `REVOKE:${agentId}:${body.timestamp}`;
  const messageBytes = new TextEncoder().encode(message);
  const proofBytes = fromBase64Url(body.proof);
  const publicKeyBytes = fromBase64Url(agent.public_key);

  const valid = verify(proofBytes, messageBytes, publicKeyBytes);
  if (!valid) return c.json({ error: "Invalid revocation proof" }, 403);

  agent.status = "revoked";
  await store.putAgent(agent);

  return c.json({ agent_id: agentId, status: "revoked" });
});

// ── Update Metadata ─────────────────────────────────────────────

app.patch("/api/agent/:id/metadata", async (c) => {
  const store = getStore(c.env);
  const agentId = c.req.param("id");
  const body = await c.req.json<MetadataUpdateRequest>();

  if (!body.metadata || !body.proof || !body.timestamp) {
    return c.json({ error: "Missing required fields: metadata, proof, timestamp" }, 400);
  }

  if (Math.abs(Date.now() - body.timestamp) > 5 * 60 * 1000) {
    return c.json({ error: "Timestamp out of range (±5 min)" }, 400);
  }

  const agent = await store.getAgent(agentId);
  if (!agent) return c.json({ error: "Agent not found" }, 404);
  if (agent.status === "revoked") return c.json({ error: "Agent is revoked" }, 403);

  // Verify proof
  const message = `METADATA:${agentId}:${body.timestamp}`;
  const messageBytes = new TextEncoder().encode(message);
  const proofBytes = fromBase64Url(body.proof);
  const publicKeyBytes = fromBase64Url(agent.public_key);

  const valid = verify(proofBytes, messageBytes, publicKeyBytes);
  if (!valid) return c.json({ error: "Invalid proof" }, 403);

  agent.metadata = { ...agent.metadata, ...body.metadata };
  await store.putAgent(agent);

  return c.json(agent);
});

// ── List Agents (for explorer UI) ───────────────────────────────

app.get("/api/agents", async (c) => {
  const store = getStore(c.env);
  const limit = parseInt(c.req.query("limit") ?? "50");
  const agents = await store.listAgents(limit);
  return c.json({ agents });
});

export default app;
