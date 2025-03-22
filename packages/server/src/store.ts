import type { AgentIdentity, Env, NonceRecord, Store } from "./types.js";

export class MemoryStore implements Store {
  private agents = new Map<string, AgentIdentity>();
  private pubkeys = new Map<string, string>();
  private nonces = new Map<string, NonceRecord>();

  async getAgent(agentId: string): Promise<AgentIdentity | null> {
    return this.agents.get(agentId) ?? null;
  }

  async putAgent(agent: AgentIdentity): Promise<void> {
    this.agents.set(agent.agent_id, agent);
  }

  async getAgentByPublicKey(publicKey: string): Promise<string | null> {
    return this.pubkeys.get(publicKey) ?? null;
  }

  async putPublicKeyMapping(publicKey: string, agentId: string): Promise<void> {
    this.pubkeys.set(publicKey, agentId);
  }

  async getNonce(nonce: string): Promise<NonceRecord | null> {
    const record = this.nonces.get(nonce);
    if (!record) return null;
    if (Date.now() - record.created_at > 5 * 60 * 1000) {
      this.nonces.delete(nonce);
      return null;
    }
    return record;
  }

  async putNonce(record: NonceRecord): Promise<void> {
    this.nonces.set(record.nonce, record);
  }

  async deleteNonce(nonce: string): Promise<void> {
    this.nonces.delete(nonce);
  }

  async listAgents(limit = 50): Promise<AgentIdentity[]> {
    return Array.from(this.agents.values())
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, limit);
  }
}
