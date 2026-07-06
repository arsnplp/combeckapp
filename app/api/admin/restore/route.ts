import { NextRequest, NextResponse } from "next/server";
import { createImpersonateToken } from "@/lib/impersonate-tokens";
import { consumeAdminRestoreToken } from "@/lib/admin-restore";

export async function POST(req: NextRequest) {
  const cookieValue = req.cookies.get("comeback_restore")?.value;
  if (!cookieValue) {
    return NextResponse.json({ error: "Cookie manquant." }, { status: 403 });
  }

  const valid = consumeAdminRestoreToken(cookieValue);
  if (!valid) {
    return NextResponse.json({ error: "Token invalide ou expiré." }, { status: 403 });
  }

  // Token one-time pour signIn admin côté client (valide 30s)
  const signInToken = createImpersonateToken("__admin__", 30 * 1000);

  const response = NextResponse.json({ token: signInToken });
  response.cookies.set("comeback_restore", "", { maxAge: 0, path: "/" });
  return response;
}
