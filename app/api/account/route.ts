import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteUser } from "@/lib/users";
import fs from "fs";
import path from "path";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const tenantId = session.user.id;

  // Supprimer les données du tenant
  const tenantDir = path.join(process.cwd(), "data", "tenants", tenantId);
  if (fs.existsSync(tenantDir)) {
    fs.rmSync(tenantDir, { recursive: true, force: true });
  }

  // Supprimer l'utilisateur
  deleteUser(tenantId);

  return NextResponse.json({ ok: true });
}
