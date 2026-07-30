// Validation de numéro de téléphone : accepte le format français (0X XX XX
// XX XX, 10 chiffres) et le format international (+ suivi de 8 à 15
// chiffres, norme E.164). Espaces, points, tirets et parenthèses sont
// ignorés avant validation.
export function normalizePhone(raw: string): string {
  return raw.replace(/[\s().-]/g, "");
}

export function isValidPhone(raw: string): boolean {
  const cleaned = normalizePhone(raw.trim());
  if (/^0[1-9]\d{8}$/.test(cleaned)) return true; // format français
  if (/^\+[1-9]\d{7,14}$/.test(cleaned)) return true; // format international
  return false;
}
