import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { resolveEmployeeSession } from "./employee-sessions";
import { getEmployeeByEmail, getEmployeeLink } from "./employees";

/**
 * Qui agit ? Un commerçant connecté via NextAuth, ou un employé connecté via
 * le cookie du portail employé et ayant déverrouillé ce commerce.
 *
 * Objectif : réutiliser les routes de crédit déjà écrites et testées
 * (plafond des tampons, clients gelés, déduction des récompenses) au lieu de
 * les dupliquer pour les employés. Le comportement commerçant est strictement
 * inchangé — la branche employé n'est atteinte que s'il n'y a pas de session
 * NextAuth.
 */
export type Actor =
  | { type: "merchant"; id: string; name: string }
  | { type: "employee"; id: string; name: string; email: string };

export interface ResolvedActor {
  /** Commerce sur lequel l'action porte. */
  tenantId: string;
  actor: Actor;
}

export async function resolveActor(req: NextRequest): Promise<ResolvedActor | null> {
  // 1) Commerçant (inchangé)
  const session = await auth();
  const merchantId = session?.user?.id;
  if (merchantId && merchantId !== "admin") {
    return {
      tenantId: merchantId,
      actor: { type: "merchant", id: merchantId, name: session?.user?.name ?? "Commerçant" },
    };
  }

  // 2) Employé
  const token = req.cookies.get("comeback_staff")?.value;
  if (!token) return null;
  const empSession = await resolveEmployeeSession(token);
  if (!empSession?.unlockedMerchantId) return null;

  const account = await getEmployeeByEmail(empSession.email);
  if (!account) return null;

  // Revérifié à CHAQUE requête, jamais seulement au déverrouillage : si le
  // commerçant retire l'employé pendant son service, l'accès doit tomber
  // immédiatement, même sur un téléphone déjà ouvert.
  const link = await getEmployeeLink(account.id, empSession.unlockedMerchantId);
  if (!link || !link.active) return null;

  return {
    tenantId: empSession.unlockedMerchantId,
    actor: {
      type: "employee",
      id: account.id,
      name: link.displayName || account.name || account.email,
      email: account.email,
    },
  };
}

/** Restreint une route au commerçant seul (réglages, facturation, export…). */
export async function requireOwner(req: NextRequest): Promise<string | null> {
  const resolved = await resolveActor(req);
  if (!resolved || resolved.actor.type !== "merchant") return null;
  return resolved.tenantId;
}
