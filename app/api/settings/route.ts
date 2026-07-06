import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserById } from "@/lib/users";
import { getTenantSettings, saveTenantSettings } from "@/lib/settings-db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const [blob, dbUser] = await Promise.all([
    getTenantSettings(session.user.id),
    getUserById(session.user.id),
  ]);
  return NextResponse.json({ ...blob, plan: dbUser?.plan ?? "starter" });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const body = await req.json();
    // La suppression d'une carte cascade automatiquement sur les customer_cards
    // (FK on delete cascade) — même comportement que l'ancien nettoyage manuel.
    await saveTenantSettings(session.user.id, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
