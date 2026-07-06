import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";

const TOKENS_PATH = path.join(process.cwd(), "data", "reset-tokens.json");
const TTL_MS = 60 * 60 * 1000; // 1 heure

interface ResetToken {
  token: string;
  email: string;
  type: "client" | "restaurant";
  expiresAt: string;
  used: boolean;
}

function read(): ResetToken[] {
  try { return JSON.parse(fs.readFileSync(TOKENS_PATH, "utf8")); }
  catch { return []; }
}

function write(tokens: ResetToken[]) {
  fs.mkdirSync(path.dirname(TOKENS_PATH), { recursive: true });
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
}

function cleanup(tokens: ResetToken[]): ResetToken[] {
  const now = Date.now();
  return tokens.filter((t) => !t.used && new Date(t.expiresAt).getTime() > now);
}

export function createResetToken(email: string, type: "client" | "restaurant"): string {
  const tokens = cleanup(read());
  // Invalider les anciens tokens du même email/type
  const filtered = tokens.filter((t) => !(t.email === email && t.type === type));
  const token = randomBytes(32).toString("hex");
  filtered.push({
    token,
    email: email.toLowerCase().trim(),
    type,
    expiresAt: new Date(Date.now() + TTL_MS).toISOString(),
    used: false,
  });
  write(filtered);
  return token;
}

export function consumeResetToken(token: string, type: "client" | "restaurant"): string | null {
  const tokens = read();
  const idx = tokens.findIndex(
    (t) => t.token === token && t.type === type && !t.used && new Date(t.expiresAt).getTime() > Date.now()
  );
  if (idx === -1) return null;
  const email = tokens[idx].email;
  tokens[idx].used = true;
  write(tokens);
  return email;
}
