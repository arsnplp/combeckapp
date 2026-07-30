import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listConversations } from "@/lib/support-messages";

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  try {
    const conversations = await listConversations();
    return NextResponse.json({ conversations });
  } catch {
    return NextResponse.json({ conversations: [] });
  }
}
