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
