import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { getUserById, updateUserPassword } from "@/lib/users";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const user = await getUserById(session.user.id);
  return NextResponse.json({ hasPassword: !!user?.passwordHash });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  if (!checkRateLimit(`change-password:${session.user.id}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Trop de tentatives. Réessayez dans quelques minutes." }, { status: 429 });
  }

  const { currentPassword, newPassword } = await req.json();
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
    return NextResponse.json({ error: "Le mot de passe doit faire au moins 8 caractères." }, { status: 400 });
  }
  if (newPassword.length > 128) {
    return NextResponse.json({ error: "Mot de passe trop long." }, { status: 400 });
  }

  const user = await getUserById(session.user.id);
  if (!user) {
    return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  }

  // Un compte créé via Google peut ne pas encore avoir de mot de passe :
  // dans ce cas, on le définit directement, sans vérification préalable.
  if (user.passwordHash) {
    const valid = typeof currentPassword === "string" && currentPassword
      ? await bcrypt.compare(currentPassword, user.passwordHash)
      : false;
    if (!valid) {
      return NextResponse.json({ error: "Mot de passe actuel incorrect." }, { status: 400 });
    }
  }

  await updateUserPassword(user.id, newPassword);
  return NextResponse.json({ ok: true });
}
