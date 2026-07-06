// In-memory one-time tokens for admin impersonation (valid 2 minutes)
const tokens = new Map<string, { userId: string; exp: number }>();

export function createImpersonateToken(userId: string, ttlMs = 2 * 60 * 1000): string {
  // Cleanup expired entries
  const now = Date.now();
  for (const [k, v] of tokens) {
    if (v.exp < now) tokens.delete(k);
  }
  const token = crypto.randomUUID();
  tokens.set(token, { userId, exp: now + ttlMs });
  return token;
}

export function consumeImpersonateToken(token: string): string | null {
  const entry = tokens.get(token);
  if (!entry) return null;
  tokens.delete(token); // one-time use
  if (entry.exp < Date.now()) return null;
  return entry.userId;
}
