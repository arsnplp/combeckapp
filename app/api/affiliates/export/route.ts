import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { resolveAffiliateSession } from "@/lib/affiliates";

// GET — export CSV des transactions de l'affilié connecté
export async function GET(req: NextRequest) {
  const token = req.cookies.get("comeback_affiliate")?.value;
  const affiliateId = token ? await resolveAffiliateSession(token) : null;
  if (!affiliateId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { data: txs } = await supabase().from("affiliate_transactions")
    .select("created_at, type, amount, description")
    .eq("affiliate_id", affiliateId).order("created_at", { ascending: false });

  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    "Date;Type;Montant (EUR);Description",
    ...(txs ?? []).map((t) => [
      new Date(t.created_at).toLocaleString("fr-FR"),
      t.type,
      Number(t.amount).toFixed(2).replace(".", ","),
      esc(t.description ?? ""),
    ].join(";")),
  ];

  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="comeback-affiliation-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
