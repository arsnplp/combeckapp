import { NextRequest, NextResponse } from "next/server";
import { createUser, setEmailVerified } from "@/lib/users";
import type { PlanId } from "@/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX = { storeName: 80, city: 60, email: 254, password: 128 };
const VALID_PLANS: PlanId[] = ["starter", "pro", "business"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email: string     = (body.email ?? "").trim().toLowerCase();
    const password: string  = body.password ?? "";
    const storeName: string = (body.storeName ?? "").trim().slice(0, MAX.storeName);
    const city: string      = (body.city ?? "").trim().slice(0, MAX.city);
    const plan: PlanId      = VALID_PLANS.includes(body.plan) ? body.plan : "starter";

    if (!email || !password || !storeName) {
      return NextResponse.json({ error: "Champs requis manquants." }, { status: 400 });
    }
    if (email.length > MAX.email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Le mot de passe doit faire au moins 8 caractères." }, { status: 400 });
    }
    if (password.length > MAX.password) {
      return NextResponse.json({ error: "Mot de passe trop long." }, { status: 400 });
    }
    if (storeName.length < 2) {
      return NextResponse.json({ error: "Le nom de l'établissement est trop court." }, { status: 400 });
    }

    const user = await createUser(email, password, storeName, plan, city || undefined);

    // Vérification email désactivée pour l'instant : sans ça, la connexion
    // automatique post-inscription (et donc le paiement) serait bloquée
    await setEmailVerified(user.id);

    // Attribution affilié : cookie posé par /ref/{code}
    const affiliateCode = req.cookies.get("comeback_ref")?.value;
    if (affiliateCode) {
      const { supabase } = await import("@/lib/supabase");
      await supabase().from("merchants").update({ affiliate_code: affiliateCode }).eq("id", user.id);
    }

    return NextResponse.json({ id: user.id, email: user.email, storeName: user.storeName, plan: user.plan });
  } catch (err) {
    if (err instanceof Error && err.message === "EMAIL_EXISTS") {
      return NextResponse.json({ error: "Cet email est déjà utilisé." }, { status: 409 });
    }
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
