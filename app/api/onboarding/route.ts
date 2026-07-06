import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { completeOnboarding } from "@/lib/users";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { storeName, city } = await req.json();
  if (!storeName || typeof storeName !== "string" || !storeName.trim()) {
    return NextResponse.json({ error: "Le nom du commerce est requis." }, { status: 400 });
  }

  await completeOnboarding(session.user.id, storeName, city);
  return NextResponse.json({ ok: true });
}
