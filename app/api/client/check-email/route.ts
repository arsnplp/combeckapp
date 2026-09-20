import { NextRequest, NextResponse } from "next/server";
import { getClientAccount } from "@/lib/client-accounts";
import { checkRateLimit, getIp, tooManyRequests } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // Cette route dit si une adresse a déjà un compte client : c'est nécessaire
  // au parcours d'inscription, mais sans plafond elle permettait de tester des
  // adresses en masse pour reconstituer la clientèle d'un commerce. 30 par
  // quart d'heure couvre un parcours normal (une poignée d'essais) sans
  // permettre le balayage d'une liste.
  if (!checkRateLimit(`check-email:${getIp(req)}`, 30, 15 * 60 * 1000)) {
    return tooManyRequests();
  }
  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ exists: false });
  }
  const account = await getClientAccount(email.toLowerCase().trim());
  return NextResponse.json({ exists: !!account });
}
