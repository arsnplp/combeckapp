import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/actor";
import { getUserById } from "@/lib/users";
import {
  getMerchantEmployees, ensureEmployeeForEmail, getEmployeeLink,
  linkEmployeeToMerchant, countMerchantEmployees, maxEmployeesForPlan,
} from "@/lib/employees";
import { getEmployeeStats } from "@/lib/activity-log";

/** GET — employés du commerce + leurs statistiques (vue rapide). */
export async function GET(req: NextRequest) {
  const tenantId = await requireOwner(req);
  if (!tenantId) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const [employees, stats, user] = await Promise.all([
    getMerchantEmployees(tenantId),
    getEmployeeStats(tenantId),
    getUserById(tenantId),
  ]);
  const statsById = new Map(stats.map((s) => [s.actorId, s]));
  const max = maxEmployeesForPlan(user?.plan ?? "starter");

  return NextResponse.json({
    maxEmployees: max === Infinity ? null : max,
    employees: employees.map((e) => ({
      employeeId: e.employeeId,
      email: e.email,
      name: e.displayName || e.name,
      active: e.active,
      createdAt: e.createdAt,
      lastAccessAt: e.lastAccessAt,
      // Le compte n'est « en attente » que tant que l'employé ne l'a pas activé
      stats: statsById.get(e.employeeId) ?? {
        stampsGiven: 0, pointsGiven: 0, rewardsValidated: 0, actions: 0, lastActionAt: null,
      },
    })),
  });
}

const AddSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(80),
  password: z.string().min(4).max(128),
});

/** POST — rattache un employé au commerce et lui définit son mot de passe d'accès. */
export async function POST(req: NextRequest) {
  const tenantId = await requireOwner(req);
  if (!tenantId) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const parsed = AddSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Email, nom et mot de passe (4 caractères min.) requis." }, { status: 400 });
  }
  const { email, name, password } = parsed.data;

  const user = await getUserById(tenantId);
  const max = maxEmployeesForPlan(user?.plan ?? "starter");
  if (max !== Infinity && (await countMerchantEmployees(tenantId)) >= max) {
    return NextResponse.json(
      { error: `Votre plan permet ${max} employé${max > 1 ? "s" : ""}. Passez à un plan supérieur pour en ajouter davantage.`, limitReached: true },
      { status: 403 },
    );
  }

  // Crée la fiche si la personne n'a pas encore de compte : elle l'activera
  // en s'inscrivant avec cet email.
  const employee = await ensureEmployeeForEmail(email, name);
  if (await getEmployeeLink(employee.id, tenantId)) {
    return NextResponse.json({ error: "Cet employé est déjà rattaché à votre commerce." }, { status: 409 });
  }

  await linkEmployeeToMerchant(employee.id, tenantId, password, name);
  return NextResponse.json({ ok: true, employeeId: employee.id, email: employee.email });
}
