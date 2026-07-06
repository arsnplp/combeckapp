import { NextResponse } from "next/server";
import { auth } from "@/auth";

// L'index email → tenants était une optimisation pour les fichiers JSON.
// Avec Supabase, la recherche est une requête SQL indexée — plus rien à reconstruire.
export async function POST() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, rebuilt: 0, obsolete: true });
}
