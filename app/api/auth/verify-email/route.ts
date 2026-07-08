import { NextRequest, NextResponse } from "next/server";
import { getUserByVerificationToken, setEmailVerified } from "@/lib/users";

// GET ?token=xxx — direct link click from email
export async function GET(req: NextRequest) {
  // Base publique : derrière nginx, req.url pointe sur localhost:3001
  const base = process.env.AUTH_URL ?? req.url;
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/verify-email?error=missing", base));
  }

  const user = await getUserByVerificationToken(token);
  if (!user) {
    return NextResponse.redirect(new URL("/verify-email?error=invalid", base));
  }

  await setEmailVerified(user.id);
  return NextResponse.redirect(new URL("/login?verified=1", base));
}

// POST { token } — called from client component
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token manquant." }, { status: 400 });
    }

    const user = await getUserByVerificationToken(token);
    if (!user) {
      return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 400 });
    }

    await setEmailVerified(user.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
