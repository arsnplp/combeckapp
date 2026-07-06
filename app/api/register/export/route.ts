import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db_getAll } from "@/lib/server-db";
import { getTenantSettings } from "@/lib/settings-db";

function escapeCsv(value: string | number | null | undefined): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const tenantId = session.user.id;
  const data = await db_getAll(tenantId);
  const settings = await getTenantSettings(tenantId);
  const cardNames = new Map<string, string>(
    (settings.loyaltyCards ?? []).map((c) => [c.id, c.name])
  );

  const headers = [
    "Nom",
    "Email",
    "Téléphone",
    "Carte",
    "Points",
    "Tampons",
    "Visites",
    "Récompenses utilisées",
    "Inscrit le",
    "Dernière activité",
  ];

  const rows: string[] = [headers.map(escapeCsv).join(",")];

  for (const customer of data.customers) {
    const ccs = data.customerCards.filter((cc) => cc.customerId === customer.id);
    const redemptions = data.redemptions.filter((r) => r.customerId === customer.id);

    if (ccs.length === 0) {
      // Customer with no cards
      rows.push([
        escapeCsv(customer.name),
        escapeCsv(customer.email),
        escapeCsv(customer.phone),
        escapeCsv(""),
        escapeCsv(0),
        escapeCsv(0),
        escapeCsv(customer.totalVisits),
        escapeCsv(redemptions.length),
        escapeCsv(customer.joinDate ? new Date(customer.joinDate).toLocaleDateString("fr-FR") : ""),
        escapeCsv(""),
      ].join(","));
    } else {
      for (const cc of ccs) {
        const cardName = cardNames.get(cc.cardId) ?? cc.cardId;
        const lastActivity = cc.lastActivity
          ? new Date(cc.lastActivity).toLocaleDateString("fr-FR")
          : "";

        rows.push([
          escapeCsv(customer.name),
          escapeCsv(customer.email),
          escapeCsv(customer.phone),
          escapeCsv(cardName),
          escapeCsv(cc.points),
          escapeCsv(cc.stamps),
          escapeCsv(customer.totalVisits),
          escapeCsv(redemptions.length),
          escapeCsv(customer.joinDate ? new Date(customer.joinDate).toLocaleDateString("fr-FR") : ""),
          escapeCsv(lastActivity),
        ].join(","));
      }
    }
  }

  const csv = rows.join("\n");
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clients-${date}.csv"`,
    },
  });
}
