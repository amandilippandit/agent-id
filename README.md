# nacht-id

**Cryptographic identity for AI agents. One line. Permanent. Unfakeable.**

You have one API key. You spin up 100 agents. They all look the same from the outside. No one can tell Agent #1 from Agent #47.

nacht-id fixes that. Every agent gets a unique, cryptographic identity that no one can fake, steal, or duplicate.

```bash
npm install nacht-id
```

```ts
import { id } from 'nacht-id'

const agent = await id('my-agent')
// Done. agent.id is a permanent cryptographic identity.
```

That's it. That's the whole thing.

---

## Why

AI agents are everywhere. They write code, send emails, deploy software, make API calls. But they have no identity. Any process can pretend to be any other process. There's no way to verify "this request actually came from that specific agent."

nacht-id gives every agent instance its own Ed25519 keypair. The private key never leaves the agent's machine. The public key is registered on a global registry. The `agent.id` is a SHA-256 hash of the public key — deterministic, verifiable, permanent.

**The identity is born inside the agent, not assigned by a server.**

---

## Usage

### One agent

```ts
import { id } from 'nacht-id'

const agent = await id('researcher')
console.log(agent.id)   // "25de8afdee35cbd92f7e806776a3ebc4..."
console.log(agent.name) // "researcher"
```

### Twenty agents

```ts
import { id } from 'nacht-id'

const agents = await Promise.all([
  'researcher', 'writer', 'reviewer', 'code-gen', 'bug-fixer',
  'pr-reviewer', 'deployer', 'monitor', 'slack-bot', 'email-drafter',
  'data-analyst', 'scraper', 'summarizer', 'translator', 'scheduler',
  'onboarding', 'support-bot', 'pipeline', 'test-runner', 'lead-qualifier',
].map(id))

agents.forEach(a => console.log(a.name, a.id))
```

One import. One statement. Twenty unique cryptographic identities.

### From objects

```ts
import { id } from 'nacht-id'

const agent = await id({ role: 'researcher', model: 'claude-sonnet-4' })
// Picks 'role' as the identity name automatically
```

Works with `name`, `role`, `id`, `type`, or `label` — whatever field your agent object already has.

### Zero config

```ts
import { id } from 'nacht-id'

const agent = await id()
// Auto-generates a persistent identity from the script filename
```

---

## Signing requests

Every agent can cryptographically sign HTTP requests. The receiving service can verify the signature came from that specific agent.

```ts
const agent = await id('deployer')

// Sign headers for any HTTP client
const headers = agent.signHeaders('POST', '/api/deploy')
await fetch('https://api.example.com/api/deploy', {
  method: 'POST',
  headers,
  body: JSON.stringify({ version: '3.2' }),
})

// Or sign a Request object directly
const req = new Request('https://api.example.com/api/deploy', { method: 'POST' })
const signed = await agent.signRequest(req)
await fetch(signed)
```

This adds three headers:
```
X-Agent-ID: 25de8afd...
X-Agent-Signature: <ed25519 signature>
X-Agent-Timestamp: 1711468800000
```

### Verifying on the server side

```ts
import { AgentID } from 'nacht-id'

const result = await AgentID.verify({
  agentId: req.headers['x-agent-id'],
  signature: req.headers['x-agent-signature'],
  message: `${req.method} ${req.path} ${req.headers['x-agent-timestamp']}`,
})

if (result.valid && result.status === 'active') {
  // This request is legit — it came from that specific agent
}
```

---

## How it works

```
Agent Process A                    nacht-id Registry               Agent Process B
─────────────                      ────────────────                 ─────────────
generates Ed25519 keypair A                                        generates Ed25519 keypair B
  ↓                                                                  ↓
signs nonce → proof A                                              signs nonce → proof B
  ↓                                                                  ↓
registers pubkey A ──────────────→ stores identity A               registers pubkey B → stores identity B
  ↓                                id = SHA256(pubkeyA)              ↓
saves privkey A to disk                                            saves privkey B to disk
  ↓                                                                  ↓
agent.id: "x7f..."                                                 agent.id: "k3a..."

Same API key. Different identities. Permanently.
```

1. Agent generates an **Ed25519 keypair** locally
2. Agent proves it owns the key by **signing a nonce** from the registry
3. Registry stores the **public key** and returns `agent.id = SHA256(publicKey)`
4. **Private key** stays on disk at `~/.agent-id/keys/{name}/` — never leaves
5. On restart, the agent **loads the same key** — same identity forever

---

## CLI

```bash
npx nacht-id init --name my-agent    # Create identity
npx nacht-id whoami                  # Show current identity
npx nacht-id list                    # List all identities
npx nacht-id verify                  # Verify with registry
npx nacht-id revoke --name my-agent  # Kill identity (permanent)
```

---

## API Reference

### `id(name?)` → `Promise<AgentID>`

The main function. Pass a string, an object, or nothing.

```ts
await id('researcher')                           // string name
await id({ role: 'researcher', model: 'claude' }) // object (uses role as name)
await id()                                        // auto-detect from filename
```

### `AgentID` instance

| Property / Method | Returns | Description |
|---|---|---|
| `.id` | `string` | Permanent unique identifier (SHA-256 of public key) |
| `.name` | `string` | Display name |
| `.publicKey` | `string` | Base64url Ed25519 public key |
| `.signHeaders(method, path)` | `SignedHeaders` | Headers for any HTTP client |
| `.signRequest(request)` | `Promise<Request>` | Sign a fetch Request object |
| `.sign(data)` | `Promise<Uint8Array>` | Sign raw bytes |
| `.profile()` | `Promise<AgentProfile>` | Fetch profile from registry |
| `.update(metadata)` | `Promise<void>` | Update name/model/runtime |
| `.revoke()` | `Promise<void>` | Permanently destroy this identity |

### `AgentID.verify(params)` → `Promise<{ valid, status }>`

Verify a signature from any agent. Use on the receiving side.

### `AgentID.init(options?)` → `Promise<AgentID>`

Full-control init with all options.

### `AgentID.load(name, options?)` → `Promise<AgentID | null>`

Load an existing identity by name.

---

## Security

| Concern | Solution |
|---|---|
| Stolen private key | Owner can revoke via signed revocation request |
| Lost private key | Identity is gone forever (by design) |
| Replay attacks | Timestamp must be within 5 min of server time |
| Forged identity | Ed25519 signatures are computationally impossible to fake |
| Double registration | Registry rejects duplicate public keys (409) |

---

## Architecture

```
nacht-id/
  packages/
    sdk/        → published as 'nacht-id' on npm
    server/     → registry API (Cloudflare Workers + KV)
```

**SDK**: Ed25519 crypto via `@noble/ed25519`. Key storage on filesystem. Works on Node, Bun, Deno.

**Server**: Hono + Cloudflare Workers. KV for persistent storage. In-memory store for local dev.

---

## Install

```bash
npm install nacht-id
# or
bun add nacht-id
# or
yarn add nacht-id
```

---

**nacht-id** — cryptographic identity for the agentic era.

Built by [Aman Pandit](https://github.com/amandilippandit).
