// Constantes partagées serveur ⇄ client pour le crédit de tampons.
// Fichier volontairement sans dépendance (pas de supabase, pas de "server-only")
// : il est importé aussi bien par server-db.ts que par des composants client.

/**
 * Nombre maximum de tampons crédités en une seule opération.
 * Garde-fou de saisie uniquement — le vrai plafond reste `stampsRequired`
 * de la carte, appliqué côté serveur dans db_addStamp.
 */
export const MAX_STAMPS_PER_SCAN = 20;

/**
 * Normalise un nombre de tampons demandé : NaN, 0, négatif, décimal ou
 * valeur absurde ne doivent jamais atteindre la base. Utilisé à l'identique
 * côté serveur et côté client pour que l'affichage optimiste corresponde
 * exactement à ce qui sera enregistré.
 */
export function normalizeStampCount(count: unknown): number {
  const parsed = Math.floor(Number(count));
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(parsed, 1), MAX_STAMPS_PER_SCAN);
}
