import { NextRequest, NextResponse } from "next/server";
import { resolveEmployeeSession } from "@/lib/employee-sessions";
import { getEmployeeByEmail, getEmployeeMerchants } from "@/lib/employees";

/** Identité de l'employé connecté + ses commerces + le commerce déverrouillé. */
export async function GET(req: NextRequest) {
  const token = req.cookies.get("comeback_staff")?.value;
  const session = token ? await resolveEmployeeSession(token) : null;
  if (!session) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const account = await getEmployeeByEmail(session.email);
  if (!account) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });

  const merchants = await getEmployeeMerchants(account.id);
  return NextResponse.json({
    email: account.email,
    name: account.name,
    unlockedMerchantId: session.unlockedMerchantId,
    merchants: merchants.map((m) => ({
      merchantId: m.merchantId,
      storeName: m.storeName,
      city: m.city,
      active: m.active,
      lastAccessAt: m.lastAccessAt,
    })),
  });
}
