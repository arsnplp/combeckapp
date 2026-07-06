import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "admin-restore-tokens.json");
const TTL = 8 * 60 * 60 * 1000; // 8 heures

function read(): Record<string, number> {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); }
  catch { return {}; }
}

function write(tokens: Record<string, number>) {
  const dir = path.dirname(FILE);
  fs.mkdirSync(dir, { recursive: true });
  const now = Date.now();
  const clean = Object.fromEntries(Object.entries(tokens).filter(([, exp]) => exp > now));
  fs.writeFileSync(FILE, JSON.stringify(clean));
}

export function createAdminRestoreToken(): string {
  const token = crypto.randomUUID();
  const tokens = read();
  tokens[token] = Date.now() + TTL;
  write(tokens);
  return token;
}

export function consumeAdminRestoreToken(token: string): boolean {
  const tokens = read();
  const exp = tokens[token];
  if (!exp || exp < Date.now()) return false;
  delete tokens[token];
  write(tokens);
  return true;
}
