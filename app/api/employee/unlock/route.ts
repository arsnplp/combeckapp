import { NextRequest, NextResponse } from "next/server";
import { resolveEmployeeSession, unlockMerchantForSession } from "@/lib/employee-sessions";
import { getEmployeeByEmail, verifyEmployeeAccess, touchEmployeeAccess } from "@/lib/employees";
import { checkRateLimit, getIp, tooManyRequests } from "@/lib/rate-limit";

/** POST { merchantId, password } — déverrouille un commerce pour le service. */
export async function POST(req: NextRequest) {
  if (!checkRateLimit(`employee-unlock:${getIp(req)}`, 15, 15 * 60 * 1000)) return tooManyRequests();

  const token = req.cookies.get("comeback_staff")?.value;
  const session = token ? await resolveEmployeeSession(token) : null;
  if (!session || !token) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { merchantId, password } = await req.json().catch(() => ({}));
  if (!merchantId || typeof password !== "string") {
    return NextResponse.json({ error: "Commerce et mot de passe requis." }, { status: 400 });
  }

  const account = await getEmployeeByEmail(session.email);
  if (!account) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });

  if (!(await verifyEmployeeAccess(account.id, merchantId, password))) {
    return NextResponse.json({ error: "Mot de passe d'accès incorrect." }, { status: 401 });
  }

  await unlockMerchantForSession(token, merchantId);
  await touchEmployeeAccess(account.id, merchantId);
  return NextResponse.json({ ok: true });
}
