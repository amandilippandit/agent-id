import { sign, toBase64Url } from "./crypto.js";

export interface SignedHeaders {
  "X-Agent-ID": string;
  "X-Agent-Signature": string;
  "X-Agent-Timestamp": string;
}

export function createSignedHeaders(
  agentId: string,
  privateKey: Uint8Array,
  method: string,
  path: string,
): SignedHeaders {
  const timestamp = Date.now().toString();
  const message = `${method.toUpperCase()} ${path} ${timestamp}`;
  const signature = sign(new TextEncoder().encode(message), privateKey);

  return {
    "X-Agent-ID": agentId,
    "X-Agent-Signature": toBase64Url(signature),
    "X-Agent-Timestamp": timestamp,
  };
}

export function signRequest(
  request: Request,
  agentId: string,
  privateKey: Uint8Array,
): Request {
  const url = new URL(request.url);
  const headers = createSignedHeaders(agentId, privateKey, request.method, url.pathname);

  const newRequest = new Request(request);
  newRequest.headers.set("X-Agent-ID", headers["X-Agent-ID"]);
  newRequest.headers.set("X-Agent-Signature", headers["X-Agent-Signature"]);
  newRequest.headers.set("X-Agent-Timestamp", headers["X-Agent-Timestamp"]);

  return newRequest;
}
