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
