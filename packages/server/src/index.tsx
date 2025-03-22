import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, RegisterRequest } from "./types.js";
import { fromBase64Url, generateNonce, fingerprint, verify } from "./crypto.js";
import { getStore } from "./store.js";

const app = new Hono<{ Bindings: Env }>();
app.use("*", cors());

app.get("/api/register/nonce", async (c) => {
  const store = getStore(c.env);
  const nonce = generateNonce();
  await store.putNonce({ nonce, created_at: Date.now(), used: false });
  return c.json({ nonce });
});

app.post("/api/register", async (c) => {
  const store = getStore(c.env);
  const body = await c.req.json<RegisterRequest>();

  if (!body.public_key || !body.proof || !body.nonce) {
    return c.json({ error: "Missing required fields: public_key, proof, nonce" }, 400);
  }

  const nonceRecord = await store.getNonce(body.nonce);
  if (!nonceRecord) return c.json({ error: "Invalid or expired nonce" }, 400);
  if (nonceRecord.used) return c.json({ error: "Nonce already used" }, 400);

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

  const nonceBytes = new TextEncoder().encode(body.nonce);
  const valid = verify(proofBytes, nonceBytes, publicKeyBytes);
  if (!valid) return c.json({ error: "Invalid proof-of-possession" }, 403);

  const existing = await store.getAgentByPublicKey(body.public_key);
  if (existing) return c.json({ error: "Public key already registered", agent_id: existing }, 409);

  const agentId = await fingerprint(publicKeyBytes);
  const agent = {
    agent_id: agentId,
    public_key: body.public_key,
    status: "active" as const,
    created_at: Date.now(),
    metadata: body.metadata ?? {},
  };

  await store.putAgent(agent);
  await store.putPublicKeyMapping(body.public_key, agentId);
  await store.deleteNonce(body.nonce);

  return c.json({ agent_id: agent.agent_id, public_key: agent.public_key, status: agent.status, created_at: agent.created_at }, 201);
});

export default app;
