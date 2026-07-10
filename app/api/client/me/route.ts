import { NextRequest, NextResponse } from "next/server";
import { resolveClientSession } from "@/lib/client-sessions";
import { getClientAccount } from "@/lib/client-accounts";

// GET — identité du client connecté (session cookie), 401 sinon
export async function GET(req: NextRequest) {
  const token = req.cookies.get("comeback_client")?.value;
  const email = token ? await resolveClientSession(token) : null;
  if (!email) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const account = await getClientAccount(email);
  return NextResponse.json({ email, name: account?.name ?? null });
}
