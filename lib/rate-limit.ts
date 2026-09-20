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

/**
 * Identifie l'appelant derrière le reverse proxy nginx.
 *
 * SÉCURITÉ — ne jamais lire la PREMIÈRE valeur de `X-Forwarded-For` : nginx est
 * configuré avec `$proxy_add_x_forwarded_for`, qui AJOUTE l'IP réelle à la
 * suite de l'en-tête envoyé par le client. Un appelant qui envoie
 * `X-Forwarded-For: 1.2.3.4` obtient donc `1.2.3.4, <son IP réelle>` : prendre
 * le premier élément revenait à le laisser choisir son identité, et donc à
 * remettre son quota à zéro à chaque requête (force brute illimitée sur toutes
 * les connexions).
 *
 * `X-Real-IP` est posé par nginx avec `proxy_set_header`, qui ÉCRASE toute
 * valeur fournie par le client : c'est la seule source fiable. En repli, on
 * prend la DERNIÈRE valeur de `X-Forwarded-For`, celle ajoutée par notre propre
 * proxy.
 */
export function getIp(req: { headers: { get(name: string): string | null } }): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((h) => h.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  return "unknown";
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
