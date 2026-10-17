/**
 * Transforme une adresse en coordonnées, via l'API Adresse de l'État.
 *
 * Choisie plutôt que Google Maps ou Mapbox : gratuite, sans clé à gérer ni
 * facturation à surveiller, et bien meilleure que les autres sur les
 * adresses françaises — ce qui est le seul cas d'usage ici.
 *
 * https://adresse.data.gouv.fr/api-doc/adresse
 */

const ENDPOINT = "https://api-adresse.data.gouv.fr/search/";

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  /** Adresse telle que normalisée par l'API, à réafficher au commerçant. */
  label: string;
  /** 0 à 1. En dessous de 0.5, l'adresse est probablement mal saisie. */
  score: number;
}

/**
 * `null` si l'adresse est introuvable ou l'API indisponible. L'appelant ne
 * doit jamais bloquer un enregistrement de réglages là-dessus : une adresse
 * non géocodée désactive simplement la notification de proximité.
 */
export async function geocodeAddress(
  address: string,
  city?: string,
): Promise<GeocodeResult | null> {
  const query = [address, city].filter(Boolean).join(" ").trim();
  if (query.length < 5) return null;

  try {
    const url = `${ENDPOINT}?q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "ComeBack/1.0 (contact@getcomeback.fr)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const feature = data?.features?.[0];
    if (!feature) return null;

    const [longitude, latitude] = feature.geometry?.coordinates ?? [];
    if (typeof latitude !== "number" || typeof longitude !== "number") return null;

    return {
      latitude,
      longitude,
      label: feature.properties?.label ?? query,
      score: feature.properties?.score ?? 0,
    };
  } catch {
    return null;
  }
}
