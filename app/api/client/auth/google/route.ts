import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function GET(req: NextRequest) {
  const state = randomBytes(16).toString("hex");
  const appUrl = process.env.AUTH_URL ?? "https://app.getcomeback.fr";

  const cardId = req.nextUrl.searchParams.get("cardId") ?? "";
  const welcomePoints = req.nextUrl.searchParams.get("welcomePoints") ?? "0";
  const ref = req.nextUrl.searchParams.get("ref") ?? "";

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${appUrl}/api/client/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });

  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);

  // Store state + optional join context in cookie
  const cookiePayload = JSON.stringify({ state, cardId, welcomePoints, ref });
  res.cookies.set("google_oauth_state", cookiePayload, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });

  return res;
}
