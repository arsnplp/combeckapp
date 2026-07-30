import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { completeOnboarding } from "@/lib/users";
import { isValidPhone } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { storeName, city, phone, password } = await req.json();
  if (!storeName || typeof storeName !== "string" || !storeName.trim()) {
    return NextResponse.json({ error: "Le nom du commerce est requis." }, { status: 400 });
  }
  if (!phone || typeof phone !== "string" || !isValidPhone(phone.trim())) {
    return NextResponse.json({ error: "Numéro de téléphone invalide." }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Le mot de passe doit faire au moins 8 caractères." }, { status: 400 });
  }
  if (password.length > 128) {
    return NextResponse.json({ error: "Mot de passe trop long." }, { status: 400 });
  }

  await completeOnboarding(session.user.id, storeName, city, phone, password);
  return NextResponse.json({ ok: true });
}
