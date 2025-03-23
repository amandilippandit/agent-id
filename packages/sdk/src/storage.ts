import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const BASE_DIR = join(homedir(), ".agent-id", "keys");

function ensureDir(dir: string): string {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function savePrivateKey(
  agentId: string,
  privateKey: Uint8Array,
  name?: string,
  basePath?: string,
): void {
  const dir = ensureDir(name ? join(basePath ?? BASE_DIR, name) : basePath ?? BASE_DIR);
  writeFileSync(join(dir, \`\${agentId}.key\`), Buffer.from(privateKey), { mode: 0o600 });
}

export function loadPrivateKey(
  agentId: string,
  name?: string,
  basePath?: string,
): Uint8Array | null {
  const dir = ensureDir(name ? join(basePath ?? BASE_DIR, name) : basePath ?? BASE_DIR);
  const filePath = join(dir, \`\${agentId}.key\`);
  if (!existsSync(filePath)) return null;
  return new Uint8Array(readFileSync(filePath));
}

export function deletePrivateKey(
  agentId: string,
  name?: string,
  basePath?: string,
): void {
  const dir = name ? join(basePath ?? BASE_DIR, name) : basePath ?? BASE_DIR;
  const filePath = join(dir, \`\${agentId}.key\`);
  if (existsSync(filePath)) unlinkSync(filePath);
}

export function listStoredKeys(name?: string, basePath?: string): string[] {
  const dir = name ? join(basePath ?? BASE_DIR, name) : basePath ?? BASE_DIR;
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".key"))
    .map((f) => f.replace(".key", ""));
}
