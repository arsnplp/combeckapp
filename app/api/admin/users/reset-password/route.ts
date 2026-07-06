import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateUserPassword } from "@/lib/users";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const { userId, newPassword } = await req.json();
  if (!userId || !newPassword) {
    return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
  }
  if (typeof newPassword !== "string" || newPassword.length < 6) {
    return NextResponse.json({ error: "Mot de passe trop court (min. 6 caractères)." }, { status: 400 });
  }

  try {
    await updateUserPassword(userId, newPassword);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
