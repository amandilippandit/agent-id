// Agent-ID Registry Server
export interface AgentIdentity {
  agent_id: string;
  public_key: string;
  status: "active" | "revoked";
  created_at: number;
  metadata: AgentMetadata;
}

export interface AgentMetadata {
  name?: string;
  runtime?: string;
  model?: string;
}

export interface NonceRecord {
  nonce: string;
  created_at: number;
  used: boolean;
}

export interface RegisterRequest {
  public_key: string;
  proof: string;
  nonce: string;
  metadata?: AgentMetadata;
}

export interface RegisterResponse {
  agent_id: string;
  public_key: string;
  status: "active";
  created_at: number;
}

export interface VerifyRequest {
  agent_id: string;
  message: string;
  signature: string;
}

export interface VerifyResponse {
  valid: boolean;
  agent_id: string;
  status: "active" | "revoked";
}

export interface RevokeRequest {
  proof: string;
  timestamp: number;
}

export interface MetadataUpdateRequest {
  metadata: AgentMetadata;
  proof: string;
  timestamp: number;
}

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

export interface Env {
  AGENT_KV: KVNamespace;
}

