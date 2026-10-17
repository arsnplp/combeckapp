import { getTenantSettings } from "./settings-db";

/**
 * Notifications de proximité — Apple Wallet uniquement.
 *
 * Quand le client passe près de la boutique, iOS fait remonter la carte sur
 * l'écran verrouillé avec un texte court. Le texte est figé dans le passe au
 * moment où il est poussé : il n'est pas recalculé à l'entrée dans la zone.
 * Ce n'est pas gênant en pratique — un passe est repoussé à chaque tampon,
 * donc le message reflète toujours la dernière visite.
 *
 * Google n'est volontairement pas couvert : son champ `locations` est
 * déprécié et ne déclenche plus rien, et son remplaçant `merchantLocations`
 * n'autorise aucun texte personnalisé ni rayon choisi. Promettre la même
 * chose sur Android serait mentir.
 */

/** Rayon de déclenchement, en mètres. Au-delà, iOS réveille trop tôt. */
export const PROXIMITY_RADIUS_M = 100;

/** Message par défaut si le commerçant n'en a pas écrit un. */
export const DEFAULT_PROXIMITY_MESSAGE = "Votre carte de fidélité {commerce}";

export interface PassLocation {
  latitude: number;
  longitude: number;
  relevantText: string;
}

export interface ProximityContext {
  storeName: string;
  clientName: string;
  stamps: number;
  stampsRequired: number;
  points: number;
  loyaltyMode: "stamps" | "points";
}

/**
 * Remplace les variables du message par les valeurs du client.
 *
 * Les accolades restent lisibles pour le commerçant qui écrit son message,
 * et une variable inconnue est laissée telle quelle plutôt que vidée : il
 * voit son erreur au lieu d'obtenir un texte amputé.
 */
export function renderProximityMessage(template: string, ctx: ProximityContext): string {
  const prenom = (ctx.clientName ?? "").trim().split(/\s+/)[0] ?? "";
  const restants = Math.max(0, (ctx.stampsRequired || 0) - (ctx.stamps || 0));

  const values: Record<string, string> = {
    commerce: ctx.storeName ?? "",
    prenom,
    tampons: String(ctx.stamps ?? 0),
    tampons_restants: String(restants),
    points: String(ctx.points ?? 0),
  };

  const rendu = (template || DEFAULT_PROXIMITY_MESSAGE)
    .replace(/\{(\w+)\}/g, (brut, cle: string) =>
      Object.prototype.hasOwnProperty.call(values, cle) ? values[cle] : brut)
    .trim();

  // L'écran verrouillé tronque au-delà d'une ligne : mieux vaut couper nous-mêmes.
  return rendu.length > 90 ? rendu.slice(0, 89).trimEnd() + "…" : rendu;
}

/**
 * Le lieu à embarquer dans le passe d'un client, ou `null` si le commerçant
 * n'a pas de coordonnées ou a désactivé la fonction.
 *
 * Apple autorise dix lieux par passe. Un commerce n'a qu'une adresse
 * aujourd'hui, donc un seul lieu — le tableau est là pour le jour où il y
 * aura plusieurs établissements.
 */
export async function buildPassLocations(
  tenantId: string | undefined,
  ctx: ProximityContext,
): Promise<PassLocation[] | null> {
  if (!tenantId) return null;
  try {
    const settings = await getTenantSettings(tenantId);
    const geo = settings.geofencing;
    if (!geo?.enabled) return null;
    if (typeof geo.latitude !== "number" || typeof geo.longitude !== "number") return null;

    return [{
      latitude: geo.latitude,
      longitude: geo.longitude,
      relevantText: renderProximityMessage(geo.message ?? DEFAULT_PROXIMITY_MESSAGE, ctx),
    }];
  } catch {
    // Jamais bloquer la génération d'un passe pour une notification de confort.
    return null;
  }
}
