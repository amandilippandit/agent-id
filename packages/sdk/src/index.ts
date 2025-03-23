import {
  generateKeypair,
  getPublicKey,
  toBase64Url,
  fingerprint,
  sign,
} from "./crypto.js";
import { savePrivateKey, loadPrivateKey, deletePrivateKey, listStoredKeys, listAgentNames, getOrCreateDefaultName } from "./storage.js";
import { signRequest, createSignedHeaders, type SignedHeaders } from "./signing.js";

const DEFAULT_REGISTRY = "https://agent-id.cognition.dev";

export interface AgentIDOptions {
  name?: string;
  model?: string;
  runtime?: string;
  registry?: string;
  storagePath?: string;
}

export interface AgentProfile {
  agent_id: string;
  public_key: string;
  status: "active" | "revoked";
  created_at: number;
  metadata: { name?: string; runtime?: string; model?: string };
}

export class AgentID {
  readonly id: string;
  readonly name: string;
  readonly publicKey: string;

  private readonly _privateKey: Uint8Array;
  private readonly _publicKeyBytes: Uint8Array;
  private readonly _registry: string;
  private readonly _name: string;
  private readonly _storagePath?: string;

  private constructor(
    id: string, name: string, publicKeyBytes: Uint8Array,
    privateKey: Uint8Array, registry: string, storagePath?: string,
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
}

export default AgentID;
