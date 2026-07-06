import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import fs from "fs";
import path from "path";
import { db_getAll } from "@/lib/server-db";
import { getClientAccount } from "@/lib/client-accounts";
import { resolveClientSession } from "@/lib/client-sessions";

function readSettings(tenantId: string) {
  try {
    const p = path.join(process.cwd(), "data", "tenants", tenantId, "settings.json");
    return JSON.parse(fs.readFileSync(p, "utf8")) as {
      settings?: { storeName?: string; storeCity?: string };
      loyaltyCards?: Array<{ id: string; name: string; loyaltyMode: string }>;
    };
  } catch {
    return {};
  }
}

export async function GET(_req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("comeback_client")?.value;
  const email = token ? resolveClientSession(token) : null;

  if (!email) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const account = getClientAccount(email);

  // Collect data across all tenants
  const tenantsDir = path.join(process.cwd(), "data", "tenants");
  const tenantData: Array<{
    storeName: string;
    storeCity: string;
    cards: Array<{
      cardName: string;
      loyaltyMode: string;
      stamps: number;
      points: number;
      joinDate: string;
      lastActivity: string;
    }>;
    redemptions: Array<{
      rewardName: string;
      cost: number;
      costType: string;
      redeemedAt: string;
    }>;
  }> = [];

  if (fs.existsSync(tenantsDir)) {
    for (const tenantId of fs.readdirSync(tenantsDir)) {
      const db = db_getAll(tenantId);
      const customer = db.customers.find(
        (c) => c.email.toLowerCase() === email.toLowerCase()
      );
      if (!customer) continue;

      const s = readSettings(tenantId);
      const cardMap = new Map((s.loyaltyCards ?? []).map((c) => [c.id, c]));
      const storeName = s.settings?.storeName ?? "Commerce";
      const storeCity = s.settings?.storeCity ?? "";

      const ccs = db.customerCards.filter((cc) => cc.customerId === customer.id);
      const redemptions = db.redemptions.filter((r) => r.customerId === customer.id);

      tenantData.push({
        storeName,
        storeCity,
        cards: ccs.map((cc) => {
          const card = cardMap.get(cc.cardId);
          return {
            cardName: card?.name ?? cc.cardId,
            loyaltyMode: card?.loyaltyMode ?? "stamps",
            stamps: cc.stamps,
            points: cc.points,
            joinDate: cc.joinDate,
            lastActivity: cc.lastActivity,
          };
        }),
        redemptions: redemptions.map((r) => ({
          rewardName: r.rewardName,
          cost: r.cost,
          costType: r.costType,
          redeemedAt: r.redeemedAt,
        })),
      });
    }
  }

  const exportData = {
    exportedAt: new Date().toISOString(),
    personalInfo: {
      email: account?.email ?? email,
      name: account?.name ?? "",
      accountCreatedAt: account?.createdAt ?? null,
    },
    loyaltyData: tenantData,
  };

  const json = JSON.stringify(exportData, null, 2);

  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="mes-donnees-comeback.json"`,
    },
  });
}
