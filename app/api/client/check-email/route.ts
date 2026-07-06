import { NextRequest, NextResponse } from "next/server";
import { getClientAccount } from "@/lib/client-accounts";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ exists: false });
  }
  const account = getClientAccount(email.toLowerCase().trim());
  return NextResponse.json({ exists: !!account });
}
