import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import type { PlanId } from "@/types";
import { supabase } from "./supabase";

export interface DbUser {
  id: string;
  email: string;
  passwordHash: string;
  storeName: string;
  city?: string;
  plan: PlanId;
  planExpiresAt?: string | null;
  createdAt: string;
  emailVerified?: boolean;
  emailVerificationToken?: string | null;
  googleId?: string;
  onboardingNeeded?: boolean;
}

interface MerchantRow {
  id: string;
  email: string;
  password_hash: string;
  store_name: string;
  city: string;
  plan: string;
  plan_expires_at?: string | null;
  created_at: string;
  email_verified: boolean;
  email_verification_token: string | null;
  google_id: string | null;
  onboarding_needed: boolean;
}

function mapUser(r: MerchantRow): DbUser {
  return {
    id: r.id,
    email: r.email,
    passwordHash: r.password_hash,
    storeName: r.store_name,
    city: r.city || undefined,
    plan: r.plan as PlanId,
    planExpiresAt: r.plan_expires_at ?? undefined,
    createdAt: r.created_at,
    emailVerified: r.email_verified,
    emailVerificationToken: r.email_verification_token,
    googleId: r.google_id ?? undefined,
    onboardingNeeded: r.onboarding_needed,
  };
}

const COLS = "id, email, password_hash, store_name, city, plan, plan_expires_at, created_at, email_verified, email_verification_token, google_id, onboarding_needed";

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const { data } = await supabase().from("merchants").select(COLS)
    .ilike("email", email.toLowerCase().trim()).maybeSingle();
  return data ? mapUser(data as MerchantRow) : null;
}

export async function getUserById(id: string): Promise<DbUser | null> {
  const { data } = await supabase().from("merchants").select(COLS).eq("id", id).maybeSingle();
  return data ? mapUser(data as MerchantRow) : null;
}

export async function getAllUsers(): Promise<DbUser[]> {
  const { data } = await supabase().from("merchants").select(COLS)
    .eq("is_admin", false).order("created_at");
  return ((data ?? []) as MerchantRow[]).map(mapUser);
}

export async function getUserByVerificationToken(token: string): Promise<DbUser | null> {
  const { data } = await supabase().from("merchants").select(COLS)
    .eq("email_verification_token", token).maybeSingle();
  return data ? mapUser(data as MerchantRow) : null;
}

export async function setEmailVerified(id: string): Promise<void> {
  await supabase().from("merchants")
    .update({ email_verified: true, email_verification_token: null }).eq("id", id);
}

export async function deleteUser(id: string): Promise<void> {
  await supabase().from("merchants").delete().eq("id", id);
}

export async function updateUserPassword(id: string, newPassword: string): Promise<void> {
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const { data } = await supabase().from("merchants")
    .update({ password_hash: passwordHash, password_plain: null })
    .eq("id", id).select("id");
  if (!data?.length) throw new Error("USER_NOT_FOUND");
}

export async function createUserFromGoogle(email: string, name: string): Promise<DbUser> {
  const normalized = email.toLowerCase().trim();
  const existing = await getUserByEmail(normalized);
  if (existing) return existing;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  const user: DbUser = {
    id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    email: normalized,
    passwordHash: "",
    storeName: name.trim() || "",
    plan: "free", // essai gratuit standard, comme toute inscription
    planExpiresAt: expiresAt.toISOString(),
    createdAt: new Date().toISOString(),
    emailVerified: true,
    googleId: normalized,
    onboardingNeeded: true,
  };
  await supabase().from("merchants").insert({
    id: user.id,
    email: user.email,
    password_hash: "",
    store_name: user.storeName,
    plan: user.plan,
    plan_expires_at: user.planExpiresAt,
    created_at: user.createdAt,
    email_verified: true,
    google_id: normalized,
    onboarding_needed: true,
    is_admin: false,
  });
  return user;
}

export async function completeOnboarding(id: string, storeName: string, city?: string): Promise<void> {
  await supabase().from("merchants").update({
    store_name: storeName.trim(),
    ...(city?.trim() ? { city: city.trim() } : {}),
    onboarding_needed: false,
  }).eq("id", id);
}

export async function createUser(
  email: string,
  password: string,
  storeName: string,
  _plan: PlanId = "free", // le plan payant n'est JAMAIS attribué ici : seul le
  city?: string,          // webhook Stripe le fait, après un vrai paiement
): Promise<DbUser> {
  const normalized = email.toLowerCase().trim();
  if (await getUserByEmail(normalized)) throw new Error("EMAIL_EXISTS");
  const passwordHash = await bcrypt.hash(password, 12);
  const verificationToken = randomBytes(32).toString("hex");
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 30);
  const user: DbUser = {
    id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    email: normalized,
    passwordHash,
    storeName: storeName.trim(),
    city: city?.trim(),
    plan: "free",
    planExpiresAt: trialEnd.toISOString(),
    createdAt: new Date().toISOString(),
    emailVerified: false,
    emailVerificationToken: verificationToken,
  };
  const { error } = await supabase().from("merchants").insert({
    id: user.id,
    email: user.email,
    password_hash: passwordHash,
    store_name: user.storeName,
    city: user.city ?? "",
    plan: "free",
    plan_expires_at: user.planExpiresAt,
    created_at: user.createdAt,
    email_verified: false,
    email_verification_token: verificationToken,
    is_admin: false,
  });
  if (error) throw new Error(error.message.includes("merchants_email_key") ? "EMAIL_EXISTS" : error.message);
  return user;
}
