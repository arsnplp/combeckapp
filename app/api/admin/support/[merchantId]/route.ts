import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getThread, sendMessage, markRead } from "@/lib/support-messages";

type Params = { merchantId: string };

export async function GET(_req: NextRequest, { params }: { params: Promise<Params> }) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { merchantId } = await params;
  const messages = await getThread(merchantId);
  await markRead(merchantId, "admin");
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest, { params }: { params: Promise<Params> }) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { merchantId } = await params;
  const { body } = await req.json();
  if (!body || typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "Message vide." }, { status: 400 });
  }
  if (body.length > 4000) {
    return NextResponse.json({ error: "Message trop long." }, { status: 400 });
  }

  const message = await sendMessage(merchantId, "admin", body.trim());
  return NextResponse.json({ message });
}
