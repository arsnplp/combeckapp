import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";
import { createFreeTrial } from "@/lib/plan-billing";
import { randomBytes } from "crypto";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  try {
    const { email, password, storeName, city } = await req.json();

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Email invalide." }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Mot de passe min. 8 caractères." }, { status: 400 });
    }
    if (!storeName || !storeName.trim()) {
      return NextResponse.json({ error: "Nom de commerce requis." }, { status: 400 });
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

    await sb.from("merchants").insert({
      id,
      email: normalized,
      password_hash: passwordHash,
      store_name: storeName.trim(),
      city: city?.trim() ?? "",
      plan: "free",
      plan_expires_at,
      created_at: new Date().toISOString(),
      email_verified: true, // essai gratuit = vérifié auto
      is_admin: false,
      affiliate_code: affiliateCode,
    });

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
