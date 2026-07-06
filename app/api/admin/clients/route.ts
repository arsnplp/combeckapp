import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAllClientAccounts, deleteClientAccount } from "@/lib/client-accounts";
import fs from "fs";
import path from "path";

interface CustomerCard {
  id: string;
  customerId: string;
  cardId: string;
  stamps: number;
  points: number;
  joinDate: string;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  joinDate: string;
}

interface LoyaltyCard {
  id: string;
  name: string;
  loyaltyMode: string;
}

interface ClientSummary {
  email: string;
  name: string;
  phone: string;
  hasPassword: boolean;
  passwordPlain: string | null;
  joinDate: string;
  cards: Array<{
    tenantId: string;
    storeName: string;
    cardName: string;
    loyaltyMode: string;
    stamps: number;
    points: number;
  }>;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const tenantsDir = path.join(process.cwd(), "data", "tenants");
  if (!fs.existsSync(tenantsDir)) {
    return NextResponse.json([]);
  }

  const clientAccounts = getAllClientAccounts();
  const accountsByEmail = new Map(clientAccounts.map((a) => [a.email.toLowerCase(), a]));

  // Map from email → ClientSummary
  const byEmail = new Map<string, ClientSummary>();

  for (const tenantId of fs.readdirSync(tenantsDir)) {
    let db: { customers: Customer[]; customerCards: CustomerCard[] };
    let settings: { settings?: { storeName?: string }; loyaltyCards?: LoyaltyCard[] };

    try {
      const dbPath = path.join(tenantsDir, tenantId, "db.json");
      db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    } catch { continue; }

    try {
      const sPath = path.join(tenantsDir, tenantId, "settings.json");
      settings = JSON.parse(fs.readFileSync(sPath, "utf8"));
    } catch {
      settings = {};
    }

    const storeName = settings.settings?.storeName ?? "Commerce";
    const loyaltyCards: LoyaltyCard[] = settings.loyaltyCards ?? [];

    for (const customer of db.customers ?? []) {
      const normalizedEmail = customer.email ? customer.email.toLowerCase().trim() : "";
      // Use email as key when available, else fall back to unique customer id
      const key = normalizedEmail || `__noemail__${customer.id}`;

      if (!byEmail.has(key)) {
        const acct = normalizedEmail ? accountsByEmail.get(normalizedEmail) : undefined;
        byEmail.set(key, {
          email: normalizedEmail,
          name: customer.name,
          phone: customer.phone ?? "",
          hasPassword: !!acct,
          passwordPlain: acct?.passwordPlain ?? null,
          joinDate: customer.joinDate,
          cards: [],
        });
      }

      const summary = byEmail.get(key)!;

      for (const cc of (db.customerCards ?? []).filter((c: CustomerCard) => c.customerId === customer.id)) {
        const lc = loyaltyCards.find((c) => c.id === cc.cardId);
        summary.cards.push({
          tenantId,
          storeName,
          cardName: lc?.name ?? "Carte",
          loyaltyMode: lc?.loyaltyMode ?? "stamps",
          stamps: cc.stamps,
          points: cc.points,
        });
      }
    }
  }

  return NextResponse.json(Array.from(byEmail.values()));
}

// DELETE — supprime un client de tous les tenants + compte client
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const { email, name } = await req.json();
  if (typeof email !== "string") {
    return NextResponse.json({ error: "Email requis." }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedName = (name ?? "").toLowerCase().trim();
  const tenantsDir = path.join(process.cwd(), "data", "tenants");

  if (fs.existsSync(tenantsDir)) {
    for (const tenantId of fs.readdirSync(tenantsDir)) {
      const dbPath = path.join(tenantsDir, tenantId, "db.json");
      try {
        const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
        const toRemove = new Set(
          (db.customers ?? [])
            .filter((c: { email: string; name: string }) => {
              if (normalizedEmail) return c.email?.toLowerCase() === normalizedEmail;
              // Sans email : supprimer par nom exact
              return !c.email && c.name?.toLowerCase() === normalizedName;
            })
            .map((c: { id: string }) => c.id)
        );
        if (toRemove.size === 0) continue;
        db.customers = (db.customers ?? []).filter((c: { id: string }) => !toRemove.has(c.id));
        db.customerCards = (db.customerCards ?? []).filter((cc: { customerId: string }) => !toRemove.has(cc.customerId));
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
      } catch { continue; }
    }
  }

  // Supprimer le compte client global (seulement si email fourni)
  if (normalizedEmail) deleteClientAccount(normalizedEmail);

  return NextResponse.json({ ok: true });
}
