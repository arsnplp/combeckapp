import { NextRequest, NextResponse } from "next/server";
import { getUserByVerificationToken, setEmailVerified } from "@/lib/users";

// GET ?token=xxx — direct link click from email
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/verify-email?error=missing", req.url));
  }

  const user = getUserByVerificationToken(token);
  if (!user) {
    return NextResponse.redirect(new URL("/verify-email?error=invalid", req.url));
  }

  setEmailVerified(user.id);
  return NextResponse.redirect(new URL("/login?verified=1", req.url));
}

// POST { token } — called from client component
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token manquant." }, { status: 400 });
    }

    const user = getUserByVerificationToken(token);
    if (!user) {
      return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 400 });
    }

    setEmailVerified(user.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
