import { NextRequest, NextResponse } from "next/server";
import { deleteClientSession } from "@/lib/client-sessions";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("comeback_client")?.value;
  if (token) deleteClientSession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set("comeback_client", "", { maxAge: 0, path: "/" });
  return res;
}
