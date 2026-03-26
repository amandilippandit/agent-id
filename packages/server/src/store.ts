import type { AgentIdentity, Env, NonceRecord, Store } from "./types.js";

// ── In-Memory Store (development) ───────────────────────────────

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
    // Expire after 5 minutes
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

// ── KV Store (Cloudflare Workers production) ────────────────────

export class KVStore implements Store {
  constructor(private kv: KVNamespace) {}

  async getAgent(agentId: string): Promise<AgentIdentity | null> {
    return this.kv.get<AgentIdentity>(`agent:${agentId}`, "json");
  }

  async putAgent(agent: AgentIdentity): Promise<void> {
    await this.kv.put(`agent:${agent.agent_id}`, JSON.stringify(agent));
  }

  async getAgentByPublicKey(publicKey: string): Promise<string | null> {
    return this.kv.get(`pubkey:${publicKey}`, "text");
  }

  async putPublicKeyMapping(publicKey: string, agentId: string): Promise<void> {
    await this.kv.put(`pubkey:${publicKey}`, agentId);
  }

  async getNonce(nonce: string): Promise<NonceRecord | null> {
    return this.kv.get<NonceRecord>(`regnonce:${nonce}`, "json");
  }

  async putNonce(record: NonceRecord): Promise<void> {
    await this.kv.put(`regnonce:${record.nonce}`, JSON.stringify(record), {
      expirationTtl: 300, // 5 minutes
    });
  }

  async deleteNonce(nonce: string): Promise<void> {
    await this.kv.delete(`regnonce:${nonce}`);
  }

  async listAgents(limit = 50): Promise<AgentIdentity[]> {
    const list = await this.kv.list({ prefix: "agent:", limit });
    const agents: AgentIdentity[] = [];
    for (const key of list.keys) {
      const agent = await this.kv.get<AgentIdentity>(key.name, "json");
      if (agent) agents.push(agent);
    }
    return agents.sort((a, b) => b.created_at - a.created_at);
  }
}

// ── Factory ─────────────────────────────────────────────────────

let memoryStore: MemoryStore | null = null;

export function getStore(env?: Env): Store {
  if (env?.AGENT_KV) {
    return new KVStore(env.AGENT_KV);
  }
  // Dev mode — singleton in-memory store
  if (!memoryStore) memoryStore = new MemoryStore();
  return memoryStore;
}
