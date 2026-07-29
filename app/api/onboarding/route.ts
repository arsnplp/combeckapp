import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { completeOnboarding } from "@/lib/users";

const PHONE_RE = /^[+\d][\d\s().-]{7,}$/;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { storeName, city, phone } = await req.json();
  if (!storeName || typeof storeName !== "string" || !storeName.trim()) {
    return NextResponse.json({ error: "Le nom du commerce est requis." }, { status: 400 });
  }
  if (!phone || typeof phone !== "string" || !PHONE_RE.test(phone.trim())) {
    return NextResponse.json({ error: "Numéro de téléphone invalide." }, { status: 400 });
  }

  await completeOnboarding(session.user.id, storeName, city, phone);
  return NextResponse.json({ ok: true });
}
