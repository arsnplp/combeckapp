// Rate limiter en mémoire — fonctionne sur un seul processus Node.js (PM2 sans cluster)

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

// Nettoyage toutes les 5 minutes pour éviter les fuites mémoire
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Vérifie et incrémente le compteur pour une clé donnée.
 * Retourne `true` si la requête est autorisée, `false` si le quota est dépassé.
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxAttempts) return false;

  entry.count++;
  return true;
}

/** Extrait l'IP depuis les headers (supporte reverse proxy Nginx). */
export function getIp(req: { headers: { get(name: string): string | null } }): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

/** Réponse 429 standard. */
export function tooManyRequests(retryAfterSec = 900) {
  const { NextResponse } = require("next/server") as typeof import("next/server");
  return NextResponse.json(
    { error: "Trop de tentatives. Réessayez dans 15 minutes." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}
