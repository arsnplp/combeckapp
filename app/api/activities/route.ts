import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/actor";
import { getActivities } from "@/lib/activity-log";

/**
 * GET — fil d'activité du commerce, lu depuis le serveur.
 * Réservé au commerçant : un employé n'a pas à consulter l'historique global.
 */
export async function GET(req: NextRequest) {
  const tenantId = await requireOwner(req);
  if (!tenantId) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  return NextResponse.json({ activities: await getActivities(tenantId, 50) });
}
