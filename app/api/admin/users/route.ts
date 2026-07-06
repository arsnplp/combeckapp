import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAllUsers } from "@/lib/users";
import { PLAN_PRICES } from "@/lib/plan-limits";
import fs from "fs";
import path from "path";

function getTenantStats(tenantId: string) {
  try {
    const dbPath = path.join(process.cwd(), "data", "tenants", tenantId, "db.json");
    const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    const clients: number = db.customers?.length ?? 0;
    const cards: number   = db.customerCards?.length ?? 0;

    // Loyalty card templates stored in settings.json
    let loyaltyCards = 0;
    try {
      const settingsPath = path.join(process.cwd(), "data", "tenants", tenantId, "settings.json");
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
      loyaltyCards = settings.loyaltyCards?.length ?? 0;
    } catch { /* no settings yet */ }

    return { clients, cards, loyaltyCards };
  } catch {
    return { clients: 0, cards: 0, loyaltyCards: 0 };
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const users = getAllUsers().map((u) => {
    const stats = getTenantStats(u.id);
    return {
      id: u.id,
      email: u.email,
      storeName: u.storeName,
      city: u.city ?? "",
      plan: u.plan,
      monthlyRevenue: PLAN_PRICES[u.plan] ?? 0,
      createdAt: u.createdAt,
      passwordPlain: u.passwordPlain ?? null,
      ...stats,
    };
  });

  return NextResponse.json(users);
}
