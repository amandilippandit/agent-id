#!/usr/bin/env node
import { AgentID } from "./index.js";
import { listAgentNames } from "./storage.js";

const REGISTRY = process.env.AGENT_ID_REGISTRY ?? "https://agent-id.cognition.dev";
const [command, ...args] = process.argv.slice(2);

function flags(args: string[]): Record<string, string> {
  const f: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) { f[args[i].slice(2)] = args[i + 1] ?? "true"; i++; }
  }
  return f;
}

async function main() {
  switch (command) {
    case "init": {
      const f = flags(args);
      if (!f.name) { console.error("Usage: agent-id init --name <name>"); process.exit(1); }
      const agent = await AgentID.init({ name: f.name, model: f.model, registry: f.registry ?? REGISTRY });
      console.log(\`  name      \${agent.name}\`);
      console.log(\`  agent_id  \${agent.id}\`);
      console.log(\`  key       \${agent.publicKey}\`);
      break;
    }
    default:
      console.log("agent-id — cryptographic identity for AI agents");
  }
}

main().catch((err) => { console.error("Error:", err.message); process.exit(1); });
