/**
 * Pastilles « Nouveau » dans la navigation.
 *
 * Elles s'effacent toutes seules au bout de trente jours : une pastille
 * permanente cesse d'attirer l'œil et finit par signaler du bruit plutôt
 * qu'une nouveauté.
 *
 * Une seule date à changer le jour de la mise en ligne.
 */

/** Date de mise en production des nouveautés signalées ci-dessous. */
export const MISE_EN_LIGNE = new Date("2026-10-18T00:00:00Z");

/** Durée d'affichage de la pastille, en jours. */
export const DUREE_NOUVEAUTE_JOURS = 30;

/** Pages à signaler. Vider la liste suffit à tout retirer avant terme. */
const PAGES_NOUVELLES = new Set(["/notifications", "/jeux"]);

/** Vrai tant que la période de trente jours court. */
export function periodeNouveauteActive(maintenant: Date = new Date()): boolean {
  return maintenant.getTime() < MISE_EN_LIGNE.getTime() + DUREE_NOUVEAUTE_JOURS * 86_400_000;
}

/** Faut-il afficher la pastille pour cette page ? */
export function estNouveau(href: string, maintenant: Date = new Date()): boolean {
  return PAGES_NOUVELLES.has(href) && periodeNouveauteActive(maintenant);
}
