import { NextRequest, NextResponse } from "next/server";
import { findClientCards } from "@/lib/client-lookup";
import { createClientAccount } from "@/lib/client-accounts";
import { auth } from "@/auth";
import { resolveClientSession } from "@/lib/client-sessions";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email requis." }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ error: "Mot de passe requis (min. 6 caractères)." }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Auth check: must be logged in as this client OR be admin
  const token = req.cookies.get("comeback_client")?.value;
  const cookieEmail = token ? resolveClientSession(token) : null;
  const session = await auth();
  const isAdmin = !!session?.user?.isAdmin;

  if (!isAdmin && cookieEmail?.toLowerCase() !== normalizedEmail) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  // Verify the email has cards
  const cards = findClientCards(normalizedEmail);
  if (cards.length === 0) {
    return NextResponse.json({ error: "Aucune carte trouvée pour cet email." }, { status: 404 });
  }

  const name = cards[0].customerName;
  await createClientAccount(normalizedEmail, password, name);

  return NextResponse.json({ ok: true });
}
