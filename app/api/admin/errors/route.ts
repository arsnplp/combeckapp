import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listSystemErrors, resolveSystemError } from "@/lib/system-errors";

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const errors = await listSystemErrors();
  return NextResponse.json({ errors });
}

// Marque une erreur comme résolue (bouton "Marquer résolu" dans /admin).
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { id } = await req.json();
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id manquant." }, { status: 400 });
  }
  await resolveSystemError(id);
  return NextResponse.json({ ok: true });
}
