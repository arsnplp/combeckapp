import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";
import { createFreeTrial } from "@/lib/plan-billing";
import { isValidPhone } from "@/lib/validation";
import { checkRateLimit, getIp, tooManyRequests } from "@/lib/rate-limit";
import { randomBytes } from "crypto";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  // Création de compte commerçant ouverte à tous : sans plafond, on pouvait
  // créer des comptes en masse (et déclencher autant d'emails de vérification).
  // 5 par quart d'heure laisse largement la place à une inscription normale,
  // y compris après plusieurs erreurs de saisie.
  if (!checkRateLimit(`free-trial:${getIp(req)}`, 5, 15 * 60 * 1000)) {
    return tooManyRequests();
  }
  try {
    const { email, password, storeName, city, phone } = await req.json();

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Email invalide." }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Mot de passe min. 8 caractères." }, { status: 400 });
    }
    if (!storeName || !storeName.trim()) {
      return NextResponse.json({ error: "Nom de commerce requis." }, { status: 400 });
    }
    if (!phone || !isValidPhone(String(phone).trim())) {
      return NextResponse.json({ error: "Numéro de téléphone invalide." }, { status: 400 });
    }

    const normalized = email.toLowerCase().trim();
    const sb = supabase();

    // Vérifier si email existe
    const { data: existing } = await sb.from("merchants").select("id").ilike("email", normalized).maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "Cet email est déjà utilisé." }, { status: 409 });
    }

    // Créer le compte gratuit
    const { id, plan_expires_at } = await createFreeTrial(normalized);
    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = randomBytes(32).toString("hex");

    // Attribution affilié : cookie posé par /ref/{code}
    const affiliateCode = req.cookies.get("comeback_ref")?.value ?? null;

    const { error: insertError } = await sb.from("merchants").insert({
      id,
      email: normalized,
      password_hash: passwordHash,
      store_name: storeName.trim(),
      city: city?.trim() ?? "",
      phone: String(phone).trim(),
      plan: "free",
      plan_expires_at,
      created_at: new Date().toISOString(),
      email_verified: true, // essai gratuit = vérifié auto
      is_admin: false,
      affiliate_code: affiliateCode,
    });
    if (insertError) {
      // Contrainte unique sur l'email (course entre deux requêtes simultanées) —
      // le check ci-dessus (ligne 31) ne suffit pas seul à s'en protéger.
      if (insertError.message.includes("merchants_email_key")) {
        return NextResponse.json({ error: "Cet email est déjà utilisé." }, { status: 409 });
      }
      throw new Error(insertError.message);
    }

    // Créer une session JWT manuelle (backend auth)
    return NextResponse.json({
      ok: true,
      userId: id,
      email: normalized,
      plan: "free",
      plan_expires_at,
      redirect: "/dashboard",
    });
  } catch (e) {
    console.error("[free-trial]", e);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
