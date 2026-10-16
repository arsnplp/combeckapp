/**
 * Reconnaît ce qui vient d'être scanné, pour n'avoir qu'un seul scanner.
 *
 * Le commerçant devait choisir « créditer » ou « valider une récompense »
 * avant de viser le QR. C'est une décision de trop au comptoir, devant un
 * client qui attend — et se tromper d'onglet donne un scan qui « ne marche
 * pas » sans dire pourquoi.
 *
 * Les deux codes ne peuvent pas être confondus :
 *  — un jeton de récompense est un UUID (`crypto.randomUUID`, avec tirets) ;
 *  — une carte client est une URL `/process/...` ou un identifiant « cc… ».
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ScanKind = "reward" | "credit";

/** `null` quand le QR n'appartient pas à ComeBack. */
export function identifyScan(raw: string): ScanKind | null {
  const value = (raw ?? "").trim();
  if (!value) return null;

  let path = value;
  try { path = new URL(value).pathname; } catch { /* déjà un chemin ou un identifiant */ }

  // Le plus explicite d'abord : l'URL portée par les cartes client.
  if (/^\/process\/.+/.test(path)) return "credit";

  // Un jeton peut arriver nu, ou au bout d'une URL.
  const dernierSegment = path.split("/").filter(Boolean).pop() ?? "";
  if (UUID_RE.test(value) || UUID_RE.test(dernierSegment)) return "reward";

  // Identifiants bruts : « cc… » pour une carte client, « c123… » pour un client.
  if (/^cc/i.test(value) || /^c\d/i.test(value)) return "credit";

  return null;
}

/** La valeur à transmettre au mode concerné : un jeton nu, ou le code tel quel. */
export function scanPayload(raw: string, kind: ScanKind): string {
  const value = (raw ?? "").trim();
  if (kind !== "reward" || UUID_RE.test(value)) return value;
  try {
    const segment = new URL(value).pathname.split("/").filter(Boolean).pop() ?? value;
    return UUID_RE.test(segment) ? segment : value;
  } catch {
    return value;
  }
}
