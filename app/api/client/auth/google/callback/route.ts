import { NextRequest, NextResponse } from "next/server";
import { createClientAccountFromGoogle } from "@/lib/client-accounts";
import { findTenantByCardId, db_getAll, db_addCustomer, db_recordPendingReferral, db_wouldReferralSucceed } from "@/lib/server-db";
import { getUserById } from "@/lib/users";
import { PLAN_LIMITS } from "@/lib/plan-limits";
import { createClientSession } from "@/lib/client-sessions";
import { getTenantSettings } from "@/lib/settings-db";

export async function GET(req: NextRequest) {
  const appUrl = process.env.AUTH_URL ?? "https://app.getcomeback.fr";
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/client/login?error=google_denied`);
  }

  // Verify CSRF state
  const rawCookie = req.cookies.get("google_oauth_state")?.value;
  if (!rawCookie) {
    return NextResponse.redirect(`${appUrl}/client/login?error=invalid_state`);
  }
  let cookiePayload: { state: string; cardId?: string; welcomePoints?: string; ref?: string };
  try {
    cookiePayload = JSON.parse(rawCookie);
  } catch {
    return NextResponse.redirect(`${appUrl}/client/login?error=invalid_state`);
  }
  if (cookiePayload.state !== state) {
    return NextResponse.redirect(`${appUrl}/client/login?error=invalid_state`);
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${appUrl}/api/client/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      console.error("Google token exchange failed:", await tokenRes.text());
      return NextResponse.redirect(`${appUrl}/client/login?error=token_exchange`);
    }

    const tokens = await tokenRes.json();

    // Get user info
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userRes.ok) {
      return NextResponse.redirect(`${appUrl}/client/login?error=userinfo`);
    }
    const userInfo = await userRes.json();
    const email: string = userInfo.email;
    const name: string = userInfo.name ?? userInfo.given_name ?? email;

    if (!email) {
      return NextResponse.redirect(`${appUrl}/client/login?error=no_email`);
    }

    await createClientAccountFromGoogle(email, name);

    const res = NextResponse.redirect(`${appUrl}/client/cards`);

    const token = await createClientSession(email);
    res.cookies.set("comeback_client", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 180,
      path: "/",
    });
    res.cookies.set("google_oauth_state", "", { maxAge: 0, path: "/" });

    // If coming from a join page, register the card
    const cardId = cookiePayload.cardId;
    if (cardId) {
      const tenantId = await findTenantByCardId(cardId);
      if (tenantId) {
        const user = await getUserById(tenantId);
        const limit = (PLAN_LIMITS[user?.plan ?? "starter"]).clients;
        const db = await db_getAll(tenantId);
        const current = db.customers.length;
        const alreadyIn = db.customers.find(
          (c) => c.email.toLowerCase() === email.toLowerCase(),
        );
        // Carte gelée (au-delà de la limite du plan) → pas de nouvelle inscription
        let cardFrozen = false;
        try {
          const blobCheck = await getTenantSettings(tenantId);
          const maxCards = (PLAN_LIMITS[user?.plan ?? "starter"]).cards;
          if (maxCards !== Infinity) {
            const prioritized = [...blobCheck.loyaltyCards]
              .sort((a, b) => (a.active === false ? 1 : 0) - (b.active === false ? 1 : 0));
            const allowedIds = new Set(prioritized.slice(0, maxCards).map((c) => c.id));
            cardFrozen = !allowedIds.has(cardId);
          }
        } catch { /* fail-open */ }
        if (!cardFrozen && !alreadyIn && (limit === Infinity || current < limit)) {
          const now = new Date().toISOString();
          const customerId = `c${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
          const customerCardId = `cc${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
          // Config carte (points de bienvenue + parrainage) lue côté serveur, pas depuis le cookie
          let welcomePoints = 0;
          let cardLoyaltyMode: "stamps" | "points" = "stamps";
          let cardStampsRequired = 8;
          let cardReferral: { enabled: boolean; referrerBonus: number; referredBonus: number } | undefined;
          try {
            const blob = await getTenantSettings(tenantId);
            const cfg = blob.loyaltyCards.find((c) => c.id === cardId);
            welcomePoints = cfg?.welcomePoints ?? 0;
            cardLoyaltyMode = cfg?.loyaltyMode ?? "stamps";
            cardStampsRequired = cfg?.stampsRequired ?? 8;
            cardReferral = cfg?.referral;
          } catch { /* 0 par défaut */ }

          const clientEmail = email.toLowerCase();
          const refAllowed = (PLAN_LIMITS[user?.plan ?? "starter"] ?? PLAN_LIMITS.starter).referralEnabled;
          const referralWillApply = !!(cookiePayload.ref && refAllowed && cardReferral?.enabled
            && await db_wouldReferralSucceed(tenantId, cookiePayload.ref, clientEmail));

          let initialStamps = 0;
          let initialPoints = welcomePoints;
          if (referralWillApply && cardReferral && cardReferral.referredBonus > 0) {
            if (cardLoyaltyMode === "stamps") initialStamps = Math.min(cardReferral.referredBonus, cardStampsRequired);
            else initialPoints += cardReferral.referredBonus;
          }

          await db_addCustomer(
            tenantId,
            { id: customerId, name, email: clientEmail, phone: "", joinDate: now, totalVisits: 0, lastVisitAt: null },
            { id: customerCardId, customerId, cardId, stamps: initialStamps, points: initialPoints, referralCount: 0, joinDate: now, lastActivity: now },
          );
          // Parrainage : enregistré en attente — le parrain sera crédité à la première visite réelle
          if (referralWillApply) {
            try {
              await db_recordPendingReferral(tenantId, cookiePayload.ref!, customerId, clientEmail);
            } catch { /* ignore referral errors */ }
          }
        }
        // Redirect to cards regardless (already registered = just log in)
        res.headers.set("location", `${appUrl}/client/cards`);
      }
    }

    return res;
  } catch (e) {
    console.error("Google OAuth callback error:", e);
    return NextResponse.redirect(`${appUrl}/client/login?error=server`);
  }
}
