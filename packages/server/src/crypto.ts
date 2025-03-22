import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";

ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface Keypair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

export function generateKeypair(): Keypair {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = ed.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

export async function fingerprint(publicKey: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", publicKey);
  return toHex(new Uint8Array(hash));
}

export function sign(message: Uint8Array, privateKey: Uint8Array): Uint8Array {
  return ed.sign(message, privateKey);
}

export function verify(
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array,
): boolean {
  try {
    return ed.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}

export function generateNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}
