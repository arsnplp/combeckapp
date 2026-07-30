import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getThread, sendMessage, markRead } from "@/lib/support-messages";
import { checkRateLimit } from "@/lib/rate-limit";

// Historique de la conversation du commerçant connecté avec le support.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  try {
    const messages = await getThread(session.user.id);
    await markRead(session.user.id, "merchant");
    return NextResponse.json({ messages });
  } catch {
    // Table pas encore migrée — répond vide plutôt que de planter le widget
    return NextResponse.json({ messages: [] });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  if (!checkRateLimit(`support-msg:${session.user.id}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Trop de messages envoyés. Réessayez plus tard." }, { status: 429 });
  }

  const { body } = await req.json();
  if (!body || typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "Message vide." }, { status: 400 });
  }
  if (body.length > 2000) {
    return NextResponse.json({ error: "Message trop long (2000 caractères max)." }, { status: 400 });
  }

  const message = await sendMessage(session.user.id, "merchant", body.trim());
  return NextResponse.json({ message });
}
