#!/usr/bin/env node
import { AgentID } from "./index.js";
import { listStoredKeys, loadPrivateKey, listAgentNames } from "./storage.js";
import { toBase64Url, sign } from "./crypto.js";

const REGISTRY = process.env.AGENT_ID_REGISTRY ?? "https://agent-id.cognition.dev";

const [command, ...args] = process.argv.slice(2);

function flags(args: string[]): Record<string, string> {
  const f: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      f[args[i].slice(2)] = args[i + 1] ?? "true";
      i++;
    }
  }
  return f;
}

async function main() {
  switch (command) {
    case "init": {
      const f = flags(args);
      if (!f.name) {
        console.error("Usage: agent-id init --name <name>");
        process.exit(1);
      }
      console.log(`Creating identity for "${f.name}"...\n`);
      const agent = await AgentID.init({
        name: f.name,
        model: f.model,
        registry: f.registry ?? REGISTRY,
      });
      console.log(`  name      ${agent.name}`);
      console.log(`  agent_id  ${agent.id}`);
      console.log(`  key       ${agent.publicKey}`);
      console.log(`\nSaved to ~/.agent-id/keys/${f.name}/${agent.id}.key`);
      break;
    }

    case "whoami": {
      const f = flags(args);
      const names = listAgentNames();
      const name = f.name ?? names[0];
      if (!name) {
        console.log("No identity found. Run: agent-id init --name my-agent");
        break;
      }
      const agent = await AgentID.load(name, { registry: REGISTRY });
      if (!agent) {
        console.log(`No identity found for "${name}".`);
        break;
      }
      console.log(`  name      ${agent.name}`);
      console.log(`  agent_id  ${agent.id}`);
      console.log(`  key       ${agent.publicKey}`);
      try {
        const profile = await agent.profile();
        console.log(`  status    ${profile.status}`);
        console.log(`  created   ${new Date(profile.created_at).toISOString()}`);
      } catch {
        console.log("  (could not reach registry)");
      }
      break;
    }

    case "verify": {
      const f = flags(args);
      const names = listAgentNames();
      const name = f.name ?? names[0];
      if (!name) {
        console.error("No identity found.");
        process.exit(1);
        return;
      }
      const ids = listStoredKeys(name);
      const id = ids[0];
      if (!id) {
        console.error(`No key for "${name}"`);
        process.exit(1);
        return;
      }
      const pk = loadPrivateKey(id, name);
      if (!pk) {
        console.error(`No key for ${id}`);
        process.exit(1);
        return;
      }
      const msg = `verify:${Date.now()}`;
      const sig = sign(new TextEncoder().encode(msg), pk);
      const result = await AgentID.verify({
        agentId: id,
        message: msg,
        signature: sig,
        registry: REGISTRY,
      });
      console.log(result.valid ? `Verified. Status: ${result.status}` : "Verification failed.");
      break;
    }

    case "revoke": {
      const f = flags(args);
      const names = listAgentNames();
      const name = f.name ?? names[0];
      if (!name) {
        console.error("No identity found.");
        process.exit(1);
        return;
      }
      const agent = await AgentID.load(name, { registry: REGISTRY });
      if (!agent) {
        console.error(`Cannot load "${name}"`);
        process.exit(1);
        return;
      }
      await agent.revoke();
      console.log(`Revoked: ${name} (${agent.id})`);
      break;
    }

    case "list": {
      const names = listAgentNames();
      if (names.length === 0) {
        console.log("No stored identities.");
        break;
      }
      console.log("Stored identities:\n");
      for (const name of names) {
        const ids = listStoredKeys(name);
        const id = ids[0] ?? "???";
        console.log(`  ${name}  →  ${id}`);
      }
      break;
    }

    default:
      console.log(`agent-id — cryptographic identity for AI agents

Usage:
  agent-id init --name <name> [--model <model>]   Create identity
  agent-id whoami [--name <name>]                  Show current identity
  agent-id verify [--name <name>]                  Verify identity
  agent-id revoke [--name <name>]                  Revoke identity (permanent)
  agent-id list                                    List all identities

In your code:
  import { AgentID } from 'nacht-id'
  const agent = await AgentID.init({ name: 'my-agent' })
`);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
