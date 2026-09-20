import type { NextConfig } from "next";

/**
 * En-têtes de sécurité appliqués à toutes les réponses.
 *
 * Pas de Content-Security-Policy ici : Next.js injecte des scripts inline dont
 * la mise en liste blanche demande des tests page par page. À ajouter dans un
 * second temps, après vérification sur l'environnement de test.
 */
const securityHeaders = [
  // Impose HTTPS pendant 2 ans. Sans preload : l'inscription sur la liste des
  // navigateurs est quasi irréversible, on ne l'ajoute pas à la légère.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Anti-clickjacking : empêche qu'un site tiers place le tableau de bord dans
  // une iframe invisible pour faire cliquer un commerçant connecté à son insu.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Empêche le navigateur de deviner un type de contenu (un logo envoyé par un
  // commerçant ne doit jamais pouvoir être interprété comme du script).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Ne divulgue pas l'URL complète (qui peut contenir un identifiant de carte)
  // aux sites externes vers lesquels on navigue.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // La caméra reste autorisée pour NOS pages : elle sert au scan des QR codes
  // (commerçant, employé et espace client). Le reste est coupé.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  // Masque l'en-tête `X-Powered-By: Next.js`, qui annonce la technologie utilisée.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
