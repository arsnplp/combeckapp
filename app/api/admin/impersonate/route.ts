import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserById } from "@/lib/users";
import { createImpersonateToken } from "@/lib/impersonate-tokens";
import { createAdminRestoreToken } from "@/lib/admin-restore";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }
  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId manquant." }, { status: 400 });

  const user = getUserById(userId);
  if (!user) return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });

  const token = createImpersonateToken(userId);

  // Token persisté en fichier (survit aux redémarrages du serveur, 8h de TTL)
  const restoreToken = createAdminRestoreToken();
  const response = NextResponse.json({ token });
  response.cookies.set("comeback_restore", restoreToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 3600,
    path: "/",
  });
  return response;
}
