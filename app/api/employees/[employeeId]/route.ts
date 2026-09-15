import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/actor";
import { unlinkEmployeeFromMerchant, setEmployeeAccessPassword, getEmployeeLink } from "@/lib/employees";

/** DELETE — le commerçant retire un employé de SON commerce uniquement. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ employeeId: string }> }) {
  const tenantId = await requireOwner(req);
  if (!tenantId) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const { employeeId } = await params;

  if (!(await getEmployeeLink(employeeId, tenantId))) {
    return NextResponse.json({ error: "Employé introuvable." }, { status: 404 });
  }
  // Coupe aussi tout déverrouillage en cours : l'accès tombe immédiatement.
  await unlinkEmployeeFromMerchant(employeeId, tenantId);
  return NextResponse.json({ ok: true });
}

/** PATCH { password } — change le mot de passe d'accès de cet employé. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ employeeId: string }> }) {
  const tenantId = await requireOwner(req);
  if (!tenantId) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const { employeeId } = await params;

  const { password } = await req.json().catch(() => ({}));
  if (typeof password !== "string" || password.length < 4) {
    return NextResponse.json({ error: "Mot de passe trop court (4 caractères min.)." }, { status: 400 });
  }
  if (!(await getEmployeeLink(employeeId, tenantId))) {
    return NextResponse.json({ error: "Employé introuvable." }, { status: 404 });
  }
  await setEmployeeAccessPassword(employeeId, tenantId, password);
  return NextResponse.json({ ok: true });
}
