import bcrypt from "bcryptjs";
import { supabase } from "./supabase";
import { PLAN_LIMITS } from "./plan-limits";
import type { PlanId } from "@/types";

/**
 * Comptes employés.
 *
 * Deux identifiants distincts, et c'est volontaire :
 *  - `employees.password_hash` : le mot de passe DU compte de l'employé, qu'il
 *    choisit lui-même. Un commerçant ne peut ni le voir ni le changer.
 *  - `employee_merchants.access_password_hash` : le mot de passe d'accès À UN
 *    commerce, défini par le commerçant.
 *
 * Sans cette séparation, un commerçant qui définirait « le » mot de passe d'un
 * employé pourrait se connecter à son compte et atteindre les AUTRES commerces
 * où cette personne travaille.
 */

export interface EmployeeAccount {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: string;
}

export interface EmployeeLink {
  id: string;
  employeeId: string;
  merchantId: string;
  displayName: string;
  active: boolean;
  createdAt: string;
  lastAccessAt: string | null;
}

interface EmployeeRow {
  id: string; email: string; password_hash: string; name: string; created_at: string;
}
interface LinkRow {
  id: string; employee_id: string; merchant_id: string; access_password_hash: string;
  display_name: string; active: boolean; created_at: string; last_access_at: string | null;
}

const mapEmployee = (r: EmployeeRow): EmployeeAccount => ({
  id: r.id, email: r.email, passwordHash: r.password_hash,
  name: r.name, createdAt: r.created_at,
});

const mapLink = (r: LinkRow): EmployeeLink => ({
  id: r.id, employeeId: r.employee_id, merchantId: r.merchant_id,
  displayName: r.display_name, active: r.active,
  createdAt: r.created_at, lastAccessAt: r.last_access_at,
});

const employeeId = (email: string) => `emp_${email.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
const norm = (email: string) => email.toLowerCase().trim();

// ── Compte global ───────────────────────────────────────────────────────────

export async function getEmployeeByEmail(email: string): Promise<EmployeeAccount | null> {
  const { data } = await supabase().from("employees").select("*")
    .ilike("email", norm(email)).maybeSingle();
  return data ? mapEmployee(data as EmployeeRow) : null;
}

export async function getEmployeeById(id: string): Promise<EmployeeAccount | null> {
  const { data } = await supabase().from("employees").select("*").eq("id", id).maybeSingle();
  return data ? mapEmployee(data as EmployeeRow) : null;
}

export async function createEmployeeAccount(
  email: string, password: string, name: string,
): Promise<EmployeeAccount | null> {
  const normalized = norm(email);
  const existing = await getEmployeeByEmail(normalized);
  if (existing) return null; // appelant responsable du message d'erreur
  const account: EmployeeAccount = {
    id: employeeId(normalized),
    email: normalized,
    passwordHash: await bcrypt.hash(password, 10),
    name: name.trim(),
    createdAt: new Date().toISOString(),
  };
  const { error } = await supabase().from("employees").insert({
    id: account.id, email: account.email, password_hash: account.passwordHash,
    name: account.name, created_at: account.createdAt,
  });
  // Course avec un appel simultané sur le même email : la ligne vient d'être
  // créée, on renvoie celle qui existe plutôt qu'un compte fantôme.
  if (error) return getEmployeeByEmail(normalized);
  return account;
}

/**
 * Crée une fiche employé SANS mot de passe si l'email est inconnu.
 * Permet au commerçant d'ajouter quelqu'un qui n'a pas encore créé son compte :
 * la personne « réclame » ensuite la fiche en s'inscrivant avec cet email.
 */
export async function ensureEmployeeForEmail(email: string, displayName: string): Promise<EmployeeAccount> {
  const normalized = norm(email);
  const existing = await getEmployeeByEmail(normalized);
  if (existing) return existing;
  const account: EmployeeAccount = {
    id: employeeId(normalized),
    email: normalized,
    passwordHash: "", // compte en attente : sera défini à l'inscription
    name: displayName.trim(),
    createdAt: new Date().toISOString(),
  };
  const { error } = await supabase().from("employees").insert({
    id: account.id, email: account.email, password_hash: "",
    name: account.name, created_at: account.createdAt,
  });
  if (error) {
    const created = await getEmployeeByEmail(normalized);
    if (created) return created;
  }
  return account;
}

/** Définit le mot de passe du COMPTE de l'employé (jamais le commerçant). */
export async function setEmployeePassword(email: string, password: string, name?: string): Promise<void> {
  const patch: Record<string, unknown> = { password_hash: await bcrypt.hash(password, 10) };
  if (name?.trim()) patch.name = name.trim();
  await supabase().from("employees").update(patch).ilike("email", norm(email));
}

/** true si la fiche existe mais n'a jamais été réclamée (aucun mot de passe). */
export function isPendingAccount(account: EmployeeAccount): boolean {
  return !account.passwordHash;
}

export async function verifyEmployeePassword(email: string, password: string): Promise<boolean> {
  const account = await getEmployeeByEmail(email);
  if (!account || !account.passwordHash) return false;
  return bcrypt.compare(password, account.passwordHash);
}

export async function deleteEmployeeAccount(email: string): Promise<void> {
  // Les rattachements et sessions suivent (FK cascade / nettoyage explicite)
  const sb = supabase();
  await sb.from("employee_sessions").delete().ilike("employee_email", norm(email));
  await sb.from("employees").delete().ilike("email", norm(email));
}

// ── Rattachement à un commerce ──────────────────────────────────────────────

/** Commerces où cet employé a un accès (pour son écran d'accueil). */
export async function getEmployeeLinks(employeeId: string): Promise<EmployeeLink[]> {
  const { data } = await supabase().from("employee_merchants").select("*")
    .eq("employee_id", employeeId).order("created_at");
  return ((data ?? []) as LinkRow[]).map(mapLink);
}

/** Commerces de l'employé, enrichis du nom d'enseigne (son écran d'accueil). */
export async function getEmployeeMerchants(
  employeeIdValue: string,
): Promise<Array<EmployeeLink & { storeName: string; city: string }>> {
  const links = await getEmployeeLinks(employeeIdValue);
  if (links.length === 0) return [];
  const { data } = await supabase().from("merchants")
    .select("id,store_name,city").in("id", links.map((l) => l.merchantId));
  const byId = new Map((data ?? []).map((m) => [m.id as string, m as { store_name: string; city: string }]));
  return links.map((l) => ({
    ...l,
    storeName: byId.get(l.merchantId)?.store_name ?? "Commerce",
    city: byId.get(l.merchantId)?.city ?? "",
  }));
}

/** Employés rattachés à un commerce (pour la page Employés du commerçant). */
export async function getMerchantEmployees(merchantId: string): Promise<Array<EmployeeLink & { email: string; name: string }>> {
  const sb = supabase();
  const { data } = await sb.from("employee_merchants").select("*")
    .eq("merchant_id", merchantId).order("created_at");
  const links = ((data ?? []) as LinkRow[]).map(mapLink);
  if (links.length === 0) return [];
  const { data: emps } = await sb.from("employees").select("id,email,name")
    .in("id", links.map((l) => l.employeeId));
  const byId = new Map((emps ?? []).map((e) => [e.id as string, e as { email: string; name: string }]));
  return links.map((l) => ({
    ...l,
    email: byId.get(l.employeeId)?.email ?? "",
    name: byId.get(l.employeeId)?.name ?? l.displayName,
  }));
}

export async function getEmployeeLink(employeeId: string, merchantId: string): Promise<(EmployeeLink & { accessPasswordHash: string }) | null> {
  const { data } = await supabase().from("employee_merchants").select("*")
    .eq("employee_id", employeeId).eq("merchant_id", merchantId).maybeSingle();
  if (!data) return null;
  const row = data as LinkRow;
  return { ...mapLink(row), accessPasswordHash: row.access_password_hash };
}

/** Le commerçant rattache un employé et lui définit son mot de passe d'accès. */
export async function linkEmployeeToMerchant(
  employeeId: string, merchantId: string, accessPassword: string, displayName: string,
): Promise<EmployeeLink> {
  const link = {
    id: `em_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    employee_id: employeeId,
    merchant_id: merchantId,
    access_password_hash: await bcrypt.hash(accessPassword, 10),
    display_name: displayName.trim(),
    active: true,
    created_at: new Date().toISOString(),
    last_access_at: null,
  };
  const { data } = await supabase().from("employee_merchants")
    .insert(link).select("*").maybeSingle();
  return mapLink((data ?? link) as LinkRow);
}

/** Changement du mot de passe d'accès par le commerçant. */
export async function setEmployeeAccessPassword(
  employeeId: string, merchantId: string, accessPassword: string,
): Promise<void> {
  await supabase().from("employee_merchants")
    .update({ access_password_hash: await bcrypt.hash(accessPassword, 10) })
    .eq("employee_id", employeeId).eq("merchant_id", merchantId);
}

export async function verifyEmployeeAccess(
  employeeId: string, merchantId: string, accessPassword: string,
): Promise<boolean> {
  const link = await getEmployeeLink(employeeId, merchantId);
  if (!link || !link.active) return false;
  return bcrypt.compare(accessPassword, link.accessPasswordHash);
}

export async function touchEmployeeAccess(employeeId: string, merchantId: string): Promise<void> {
  await supabase().from("employee_merchants")
    .update({ last_access_at: new Date().toISOString() })
    .eq("employee_id", employeeId).eq("merchant_id", merchantId);
}

/**
 * Retrait d'un employé d'un commerce — déclenché par le commerçant OU par
 * l'employé lui-même ("quitter ce commerce"). Coupe aussi tout déverrouillage
 * en cours, sinon l'accès resterait ouvert jusqu'à expiration sur un téléphone
 * déjà déverrouillé.
 */
export async function unlinkEmployeeFromMerchant(employeeId: string, merchantId: string): Promise<void> {
  const sb = supabase();
  const emp = await getEmployeeById(employeeId);
  await sb.from("employee_merchants").delete()
    .eq("employee_id", employeeId).eq("merchant_id", merchantId);
  if (emp) {
    await sb.from("employee_sessions")
      .update({ unlocked_merchant_id: null, unlocked_until: null })
      .ilike("employee_email", emp.email).eq("unlocked_merchant_id", merchantId);
  }
}

// ── Limite du plan ──────────────────────────────────────────────────────────

/** Nombre d'employés autorisés pour un plan (Infinity = illimité). */
export function maxEmployeesForPlan(plan: PlanId): number {
  return (PLAN_LIMITS[plan] ?? PLAN_LIMITS.starter).employees;
}

export async function countMerchantEmployees(merchantId: string): Promise<number> {
  const { count } = await supabase().from("employee_merchants")
    .select("id", { count: "exact", head: true }).eq("merchant_id", merchantId);
  return count ?? 0;
}
