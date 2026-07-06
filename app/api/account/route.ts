import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteUser } from "@/lib/users";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  // Supprimer le commerçant — toutes ses données (cartes, clients, soldes,
  // récompenses, produits, historique) suivent via les FK on delete cascade.
  await deleteUser(session.user.id);

  return NextResponse.json({ ok: true });
}
