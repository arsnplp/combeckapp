import { NextRequest, NextResponse } from "next/server";
import {
  db_addCustomer, db_addPoints, db_addStamp,
  db_deleteCustomer, db_getAll, findTenantByCardId,
  db_deductReward, db_addRedemption, db_incrementRewardUsage, db_addReferral,
} from "@/lib/server-db";
import { walletNotificationService } from "@/lib/wallet-notification-service";
import { auth } from "@/auth";
import { getUserById } from "@/lib/users";
import { PLAN_LIMITS } from "@/lib/plan-limits";
import { createClientAccount, getClientAccount, verifyClientPassword } from "@/lib/client-accounts";
import { sendWelcomeClient } from "@/lib/mailer";
import { checkRateLimit, getIp, tooManyRequests } from "@/lib/rate-limit";
import { createClientSession } from "@/lib/client-sessions";
import { z } from "zod";

const RegisterSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("new"),
    cardId: z.string().min(1),
    name: z.string().min(1).max(100),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().max(30).optional(),
    password: z.string().min(6).max(128).optional(),
    welcomePoints: z.number().int().min(0).optional(),
    ref: z.string().optional(),
  }),
  z.object({
    mode: z.literal("existing"),
    cardId: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(1).max(128),
    welcomePoints: z.number().int().min(0).optional(),
    ref: z.string().optional(),
  }),
]);

// POST — appelé depuis /join/[cardId] (sans session auth) — cherche le tenant par cardId
export async function POST(req: NextRequest) {
  // 20 tentatives / 15 min par IP (plus souple que le login car inclut l'inscription)
  if (!checkRateLimit(`register:${getIp(req)}`, 20, 15 * 60 * 1000)) {
    return tooManyRequests();
  }
  try {
    const parsed = RegisterSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    }
    const body = parsed.data;
    const { mode, cardId, welcomePoints } = body;
    // password existe sur les deux variantes mais avec types différents — on accède via body directement
    const password = "password" in body ? (body.password as string | undefined) : undefined;

    const tenantId = findTenantByCardId(cardId);
    if (!tenantId) return NextResponse.json({ error: "Card not found" }, { status: 404 });

    // Vérifier la limite de clients selon le plan
    const user = getUserById(tenantId);
    if (user) {
      const limit = (PLAN_LIMITS[user.plan] ?? PLAN_LIMITS["starter"]).clients;
      if (limit !== Infinity) {
        const current = db_getAll(tenantId).customers.length;
        if (current >= limit) {
          return NextResponse.json(
            { error: `Limite de ${limit} clients atteinte pour ce commerce.` },
            { status: 403 },
          );
        }
      }
    }

    let clientName: string;
    let clientEmail: string;
    let clientPhone: string;

    if (mode === "existing") {
      // ── Compte existant : vérifier email + mot de passe ──────────────────
      const email = (body.email as string)?.toLowerCase().trim();
      if (!email || !password) {
        return NextResponse.json({ error: "Email et mot de passe requis." }, { status: 400 });
      }
      const account = getClientAccount(email);
      if (!account) {
        return NextResponse.json({ error: "Aucun compte trouvé avec cet email." }, { status: 401 });
      }
      const ok = await verifyClientPassword(email, password);
      if (!ok) {
        return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 });
      }
      clientName = account.name;
      clientEmail = email;
      clientPhone = "";
    } else {
      // ── Nouveau compte ────────────────────────────────────────────────────
      const newBody = body as Extract<typeof body, { mode: "new" }>;
      const name = newBody.name?.trim();
      const email = newBody.email?.toLowerCase().trim() ?? "";
      if (!name) return NextResponse.json({ error: "Le nom est requis." }, { status: 400 });

      // Bloquer si l'email est déjà pris
      if (email) {
        const existingAccount = getClientAccount(email);
        if (existingAccount) {
          return NextResponse.json(
            { error: "Cet email est déjà associé à un compte ComeBack. Utilisez \"J'ai déjà un compte\"." },
            { status: 409 },
          );
        }
      }

      clientName = name;
      clientEmail = email;
      clientPhone = newBody.phone ?? "";

      // Créer le compte si email + mot de passe fournis
      if (email && password && typeof password === "string") {
        await createClientAccount(email, password, name);
      }
    }

    // Empêcher la double inscription au même restaurant
    if (clientEmail) {
      const alreadyIn = db_getAll(tenantId).customers.find(
        (c) => c.email.toLowerCase() === clientEmail,
      );
      if (alreadyIn) {
        return NextResponse.json({ error: "Vous êtes déjà inscrit dans ce commerce.", alreadyExists: true }, { status: 409 });
      }
    }

    const now = new Date().toISOString();
    const customerId = `c${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
    const customerCardId = `cc${Date.now()}${Math.random().toString(36).slice(2, 5)}`;

    db_addCustomer(tenantId,
      { id: customerId, name: clientName, email: clientEmail, phone: clientPhone, joinDate: now, totalVisits: 0, lastVisitAt: null },
      { id: customerCardId, customerId, cardId, stamps: 0, points: welcomePoints ?? 0, referralCount: 0, referralPoints: 0, joinDate: now, lastActivity: now }
    );

    // Bonus parrainage — crédite le parrain d'un point de parrainage
    const ref = body.ref;
    if (ref) {
      try {
        db_addReferral(tenantId, ref);
        // La carte wallet du parrain affiche ses parrainages → synchro
        walletNotificationService.updatePoints(ref).catch(console.error);
      } catch { /* ignore referral errors */ }
    }

    // Email de bienvenue (fire-and-forget, uniquement pour nouveaux comptes)
    if (mode !== "existing" && clientEmail) {
      const tenantUser = getUserById(tenantId);
      const storeName = tenantUser?.storeName ?? "ce commerce";
      sendWelcomeClient(clientEmail, clientName, storeName).catch(console.error);
    }

    const res = NextResponse.json({ ok: true, customerId, customerCardId, clientName });

    // Auto-connecter le client avec un token de session opaque
    if (clientEmail) {
      const token = createClientSession(clientEmail);
      res.cookies.set("comeback_client", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
    }

    return res;
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// GET — appelé depuis le dashboard (avec session)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ customers: [], customerCards: [], redemptions: [] });
  const data = db_getAll(session.user.id);

  // Recherche rapide par nom/email (pour le scanner)
  const q = req.nextUrl.searchParams.get("q")?.toLowerCase().trim();
  if (q) {
    const filtered = data.customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.includes(q),
    );
    const ids = new Set(filtered.map((c) => c.id));
    // Lire les loyalty cards depuis settings.json du tenant
    let loyaltyCards: { id: string; name: string; loyaltyMode: string }[] = [];
    try {
      const fs = (await import("fs")).default;
      const path = (await import("path")).default;
      const p = path.join(process.cwd(), "data", "tenants", session.user.id, "settings.json");
      const s = JSON.parse(fs.readFileSync(p, "utf8"));
      loyaltyCards = s.loyaltyCards ?? [];
    } catch { /* pas de settings */ }
    return NextResponse.json({
      customers: filtered,
      customerCards: data.customerCards.filter((cc) => ids.has(cc.customerId)),
      redemptions: data.redemptions.filter((r) => ids.has(r.customerId)),
      loyaltyCards,
    });
  }

  return NextResponse.json(data);
}

// PATCH — appelé depuis le dashboard (avec session) pour ajouter tampon/points
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const body = await req.json();
    const { action, customerCardId, points } = body;
    const tenantId = session.user.id;
    if (action === "stamp") {
      db_addStamp(tenantId, customerCardId);
      walletNotificationService.updateStamps(customerCardId).catch(console.error);
    } else if (action === "points") {
      db_addPoints(tenantId, customerCardId, points ?? 0);
      walletNotificationService.updatePoints(customerCardId).catch(console.error);
    } else if (action === "reward") {
      const { rewardName, rewardEmoji, cost, costType, customerId } = body;
      db_deductReward(tenantId, customerCardId, costType, cost);
      db_addRedemption(tenantId, {
        customerId,
        customerCardId,
        rewardName,
        rewardEmoji,
        cost,
        costType,
        redeemedAt: new Date().toISOString(),
      });
      db_incrementRewardUsage(tenantId, rewardName);
      if (costType === "stamps") walletNotificationService.updateStamps(customerCardId).catch(console.error);
      else walletNotificationService.updatePoints(customerCardId).catch(console.error);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE — appelé depuis le dashboard (avec session)
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const { customerId } = await req.json();
    if (!customerId) return NextResponse.json({ error: "Missing customerId" }, { status: 400 });
    db_deleteCustomer(session.user.id, customerId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
