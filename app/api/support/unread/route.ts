import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { countUnreadForMerchant } from "@/lib/support-messages";

// Endpoint léger pour le badge du widget de chat (pollé régulièrement,
// séparé de /messages pour ne pas marquer les messages comme lus tant que
// le commerçant n'a pas réellement ouvert la conversation).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ count: 0 });
  }
  try {
    const count = await countUnreadForMerchant(session.user.id);
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
