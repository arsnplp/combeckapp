import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import { auth } from "@/auth";
import { getUserById } from "@/lib/users";
import { db_getAll } from "@/lib/server-db";
import fs from "fs";

function settingsPath(tenantId: string): string {
  return path.join(process.cwd(), "data", "tenants", tenantId, "settings.json");
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const p = settingsPath(session.user.id);
  const dbUser = getUserById(session.user.id);
  try {
    const base = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {};
    return NextResponse.json({ ...base, plan: dbUser?.plan ?? "starter" });
  } catch {
    return NextResponse.json({ plan: dbUser?.plan ?? "starter" });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const tenantId = session.user.id;
  const p = settingsPath(tenantId);
  try {
    const body = await req.json();

    // Détecter les cartes supprimées et nettoyer les customerCards orphelins
    const newCardIds = new Set<string>(
      (body.loyaltyCards ?? []).map((c: { id: string }) => c.id),
    );
    if (existsSync(p)) {
      const old = JSON.parse(readFileSync(p, "utf8"));
      const oldCardIds: string[] = (old.loyaltyCards ?? []).map((c: { id: string }) => c.id);
      const deletedIds = oldCardIds.filter((id) => !newCardIds.has(id));

      if (deletedIds.length > 0) {
        const dbPath = path.join(process.cwd(), "data", "tenants", tenantId, "db.json");
        const db = db_getAll(tenantId);
        const before = db.customerCards.length;
        db.customerCards = db.customerCards.filter((cc) => !deletedIds.includes(cc.cardId));
        db.redemptions = db.redemptions.filter(
          (r) => !deletedIds.includes(
            db.customerCards.find((cc) => cc.id === r.customerCardId)?.cardId ?? "",
          ),
        );
        if (db.customerCards.length !== before) {
          const tmp = dbPath + ".tmp";
          fs.mkdirSync(path.dirname(dbPath), { recursive: true });
          fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
          fs.renameSync(tmp, dbPath);
        }
      }
    }

    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(body, null, 2));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
