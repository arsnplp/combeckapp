import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";

const SESSIONS_PATH = path.join(process.cwd(), "data", "client-sessions.json");

interface Session {
  token: string;
  email: string;
  createdAt: string;
  expiresAt: string;
}

function read(): Session[] {
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_PATH, "utf8"));
  } catch {
    return [];
  }
}

function write(sessions: Session[]) {
  const tmp = SESSIONS_PATH + ".tmp";
  fs.mkdirSync(path.dirname(SESSIONS_PATH), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(sessions, null, 2));
  fs.renameSync(tmp, SESSIONS_PATH);
}

function purgeExpired(sessions: Session[]): Session[] {
  const now = Date.now();
  return sessions.filter((s) => new Date(s.expiresAt).getTime() > now);
}

/** Crée une session pour un email, retourne le token opaque. */
export function createClientSession(email: string, ttlDays = 30): string {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
  const sessions = purgeExpired(read());
  sessions.push({
    token,
    email: email.toLowerCase().trim(),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });
  write(sessions);
  return token;
}

/** Résout un token → email, ou null si invalide/expiré. */
export function resolveClientSession(token: string): string | null {
  if (!token) return null;
  const sessions = purgeExpired(read());
  const session = sessions.find((s) => s.token === token);
  if (!session) return null;
  return session.email;
}

/** Supprime une session (logout). */
export function deleteClientSession(token: string): void {
  const sessions = purgeExpired(read()).filter((s) => s.token !== token);
  write(sessions);
}

/** Supprime toutes les sessions d'un email (suppression de compte). */
export function deleteAllClientSessions(email: string): void {
  const normalized = email.toLowerCase().trim();
  const sessions = purgeExpired(read()).filter(
    (s) => s.email !== normalized,
  );
  write(sessions);
}
