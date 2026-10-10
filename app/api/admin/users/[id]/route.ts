import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteMerchant, merchantImpact } from "@/lib/delete-merchant";
import { notifyAdminEmail } from "@/lib/mailer";

/** GET — ce que la suppression emporterait, pour l'afficher avant de valider. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }
  const { id } = await params;
  const impact = await merchantImpact(id);
  if (!impact) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  return NextResponse.json(impact);
}

/**
 * DELETE — suppression définitive.
 *
 * La confirmation par saisie du nom est vérifiée ici et pas seulement dans
 * l'interface : une requête directe ne doit pas pouvoir effacer un compte
 * client en une ligne de terminal.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const { id } = await params;
  let confirm = "";
  try {
    confirm = (await req.json())?.confirm ?? "";
  } catch { /* corps vide : seuls les comptes sans historique passeront */ }

  const impact = await merchantImpact(id);
  if (!impact) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  if (impact.isAdmin) {
    return NextResponse.json({ error: "Un compte administrateur ne peut pas être supprimé." }, { status: 400 });
  }
  if (impact.requiresTyping && confirm.trim() !== impact.storeName.trim()) {
    return NextResponse.json(
      { error: `Ce compte a de l'historique. Saisissez « ${impact.storeName} » pour confirmer.` },
      { status: 428 },
    );
  }

  try {
    const report = await deleteMerchant(id);
    console.log(`[admin] Compte supprimé : ${impact.storeName} <${impact.email}>`, report);
    // Trace par email : une suppression de compte ne doit pas pouvoir passer
    // inaperçue, y compris si elle vient d'un second administrateur.
    notifyAdminEmail("Compte commerçant supprimé", {
      Commerce: impact.storeName,
      Email: impact.email,
      Plan: impact.plan,
      "Lignes supprimées": String(impact.totalRows + 1),
      Stripe: report.stripe,
      "Supprimé par": session.user?.email ?? "admin",
    }).catch(() => {});
    return NextResponse.json({ ok: true, storeName: impact.storeName, ...report });
  } catch (e) {
    console.error("[admin] suppression", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Suppression impossible." },
      { status: 500 },
    );
  }
}
