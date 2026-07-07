import bcrypt from "bcryptjs";
import { supabase } from "./supabase";

export interface ClientAccount {
  email: string;
  passwordHash: string;
  name: string;
  createdAt: string;
  googleId?: string;
}

interface ClientRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  google_id: string | null;
  created_at: string;
}

function mapAccount(r: ClientRow): ClientAccount {
  return {
    email: r.email,
    passwordHash: r.password_hash,
    name: r.name,
    createdAt: r.created_at,
    googleId: r.google_id ?? undefined,
  };
}

function clientId(email: string): string {
  return `cl_${email.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
}

export async function getClientAccount(email: string): Promise<ClientAccount | null> {
  const { data } = await supabase().from("clients").select("*")
    .ilike("email", email.toLowerCase().trim()).maybeSingle();
  return data ? mapAccount(data as ClientRow) : null;
}

export async function getAllClientAccounts(): Promise<ClientAccount[]> {
  const { data } = await supabase().from("clients").select("*").order("created_at");
  return ((data ?? []) as ClientRow[]).map(mapAccount);
}

export async function createClientAccount(
  email: string,
  password: string,
  name: string,
): Promise<ClientAccount> {
  const normalized = email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(password, 10);
  const account: ClientAccount = {
    email: normalized,
    passwordHash,
    name,
    createdAt: new Date().toISOString(),
  };
  const sb = supabase();
  const { data: existing } = await sb.from("clients").select("id").ilike("email", normalized).maybeSingle();
  if (existing) {
    await sb.from("clients").update({
      password_hash: passwordHash, password_plain: null, name, created_at: account.createdAt,
    }).eq("id", existing.id);
  } else {
    await sb.from("clients").insert({
      id: clientId(normalized), email: normalized,
      password_hash: passwordHash, name, created_at: account.createdAt,
    });
  }
  return account;
}

export async function verifyClientPassword(email: string, password: string): Promise<boolean> {
  const account = await getClientAccount(email);
  if (!account) return false;
  return bcrypt.compare(password, account.passwordHash);
}

export async function resetClientPassword(email: string, newPassword: string): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(newPassword, 10);
  const sb = supabase();
  const { data: existing } = await sb.from("clients").select("id").ilike("email", normalized).maybeSingle();
  if (existing) {
    await sb.from("clients").update({ password_hash: passwordHash, password_plain: null }).eq("id", existing.id);
  } else {
    await sb.from("clients").insert({
      id: clientId(normalized), email: normalized,
      password_hash: passwordHash,
      name: normalized, created_at: new Date().toISOString(),
    });
  }
}

export async function createClientAccountFromGoogle(email: string, name: string): Promise<ClientAccount> {
  const normalized = email.toLowerCase().trim();
  const sb = supabase();
  const existing = await getClientAccount(normalized);
  if (existing) {
    if (!existing.googleId) {
      await sb.from("clients").update({ google_id: normalized }).ilike("email", normalized);
      existing.googleId = normalized;
    }
    return existing;
  }
  const account: ClientAccount = {
    email: normalized,
    passwordHash: "",
    name: name.trim() || normalized,
    createdAt: new Date().toISOString(),
    googleId: normalized,
  };
  await sb.from("clients").insert({
    id: clientId(normalized), email: normalized, password_hash: "",
    name: account.name, google_id: normalized, created_at: account.createdAt,
  });
  return account;
}

export async function deleteClientAccount(email: string): Promise<void> {
  await supabase().from("clients").delete().ilike("email", email.toLowerCase().trim());
}
