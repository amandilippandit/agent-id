import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const BASE_DIR = join(homedir(), ".agent-id", "keys");

function ensureDir(dir: string): string {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/** Get the storage directory for a given agent name (or the global dir) */
export function getAgentDir(name?: string, basePath?: string): string {
  const base = basePath ?? BASE_DIR;
  return name ? join(base, name) : base;
}

export function savePrivateKey(
  agentId: string,
  privateKey: Uint8Array,
  name?: string,
  basePath?: string,
): void {
  const dir = ensureDir(getAgentDir(name, basePath));
  writeFileSync(join(dir, `${agentId}.key`), Buffer.from(privateKey), { mode: 0o600 });
}

export function loadPrivateKey(
  agentId: string,
  name?: string,
  basePath?: string,
): Uint8Array | null {
  const dir = ensureDir(getAgentDir(name, basePath));
  const filePath = join(dir, `${agentId}.key`);
  if (!existsSync(filePath)) return null;
  return new Uint8Array(readFileSync(filePath));
}

export function deletePrivateKey(
  agentId: string,
  name?: string,
  basePath?: string,
): void {
  const dir = getAgentDir(name, basePath);
  const filePath = join(dir, `${agentId}.key`);
  if (existsSync(filePath)) unlinkSync(filePath);
}

export function listStoredKeys(name?: string, basePath?: string): string[] {
  const dir = getAgentDir(name, basePath);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".key"))
    .map((f) => f.replace(".key", ""));
}

/** List all agent names that have stored keys */
export function listAgentNames(basePath?: string): string[] {
  const base = basePath ?? BASE_DIR;
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

/** Get or create a persistent default name for this project directory */
export function getOrCreateDefaultName(basePath?: string): string {
  const base = basePath ?? BASE_DIR;
  ensureDir(base);
  const defaultFile = join(base, ".default");

  // Already have a default name for this cwd
  if (existsSync(defaultFile)) {
    const saved = readFileSync(defaultFile, "utf-8").trim();
    if (saved) return saved;
  }

  // Generate a unique name: adjective-noun-4hex
  const adj = ["swift", "bright", "calm", "bold", "keen", "sharp", "quick", "warm", "cool", "wise"];
  const noun = ["fox", "owl", "wolf", "hawk", "lynx", "bear", "dart", "ray", "arc", "node"];
  const hex = Math.random().toString(16).slice(2, 6);
  const name = `${adj[Math.floor(Math.random() * adj.length)]}-${noun[Math.floor(Math.random() * noun.length)]}-${hex}`;

  writeFileSync(defaultFile, name, { mode: 0o600 });
  return name;
}
