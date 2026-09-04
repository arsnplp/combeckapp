import { NextRequest, NextResponse } from "next/server";
import { findTenantByCardId } from "@/lib/server-db";
import { getTenantSettings } from "@/lib/settings-db";

/**
 * GET /api/join/[cardId] — métadonnées d'affichage d'une carte de fidélité.
 *
 * Public (pas de session) : ces informations sont déjà celles qu'un client
 * reçoit en scannant le QR d'inscription. Rien de sensible n'est renvoyé —
 * uniquement de quoi dessiner la carte avant l'inscription.
 *
 * Permet au QR d'inscription de ne contenir que l'URL courte
 * `/join/{cardId}` au lieu d'y embarquer tout le design en base64 : le QR
 * passe de ~85x85 à ~29x29 modules, donc infiniment plus facile à scanner.
 * Bénéfice secondaire : le design affiché est toujours à jour, même sur une
 * affiche imprimée il y a des mois.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await params;
  if (!cardId) return NextResponse.json({ error: "Carte inconnue." }, { status: 400 });

  const tenantId = await findTenantByCardId(cardId);
  if (!tenantId) return NextResponse.json({ error: "Carte introuvable." }, { status: 404 });

  try {
    const blob = await getTenantSettings(tenantId);
    const card = blob.loyaltyCards.find((c) => c.id === cardId);
    if (!card) return NextResponse.json({ error: "Carte introuvable." }, { status: 404 });

    return NextResponse.json({
      id: card.id,
      name: card.name,
      welcomeMessage: card.welcomeMessage ?? "",
      backgroundColor: card.backgroundColor,
      accentColor: card.accentColor,
      textColor: card.textColor,
      loyaltyMode: card.loyaltyMode ?? "stamps",
      stampsRequired: card.stampsRequired ?? 8,
      pointsPerEuro: card.pointsPerEuro ?? 10,
      welcomePoints: card.welcomePoints ?? 0,
      ...(card.stripPreset ? { stripPreset: card.stripPreset } : {}),
      storeName: (blob.settings.storeName as string) || card.name,
    });
  } catch {
    return NextResponse.json({ error: "Carte indisponible." }, { status: 404 });
  }
}
