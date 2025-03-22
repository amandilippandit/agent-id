import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types.js";
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

export default app;
