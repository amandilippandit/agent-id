# nacht-id

**Cryptographic identity for AI agents. One line. Permanent. Unfakeable.**

Agents today are ghosts. They share API keys, run as anonymous processes, and leave no verifiable trace of who did what. When an agent sends an email, deploys code, or calls an API — there's no way to prove which agent did it, or that it was even an agent you authorized. nacht-id gives every agent instance its own Ed25519 keypair — a self-sovereign, cryptographic identity that's generated inside the agent, never leaves its environment, and can be verified by anyone without trusting a central authority. One line of code. No config. No accounts. Just math.

---

## Install

```bash
npm install nacht-id
```

## Quick Start

```ts
import { id } from 'nacht-id'

const agent = await id('my-agent')
// Done. agent.id is a permanent cryptographic identity.
```
