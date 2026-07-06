import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import fs from "fs";
import path from "path";
import { db_getAll } from "@/lib/server-db";
import { getAllClientAccounts } from "@/lib/client-accounts";
import { resolveClientSession, deleteAllClientSessions } from "@/lib/client-sessions";
import { indexRemoveAllForEmail } from "@/lib/client-index";

function dbPath(tenantId: string): string {
  return path.join(process.cwd(), "data", "tenants", tenantId, "db.json");
}

function readResetTokens() {
  try {
    const p = path.join(process.cwd(), "data", "reset-tokens.json");
    return JSON.parse(fs.readFileSync(p, "utf8")) as Array<{
      token: string; email: string; type: string; expiresAt: string; used: boolean;
    }>;
  } catch {
    return [];
  }
}

function writeResetTokens(tokens: ReturnType<typeof readResetTokens>) {
  const p = path.join(process.cwd(), "data", "reset-tokens.json");
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(tokens, null, 2));
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("comeback_client")?.value;
  const email = token ? resolveClientSession(token) : null;

  if (!email) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  let body: { confirm?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  if (!body.confirm) {
    return NextResponse.json({ error: "Confirmation requise." }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // 1. Delete customer entries across all tenants
  const tenantsDir = path.join(process.cwd(), "data", "tenants");
  if (fs.existsSync(tenantsDir)) {
    for (const tenantId of fs.readdirSync(tenantsDir)) {
      const db = db_getAll(tenantId);
      const customer = db.customers.find(
        (c) => c.email.toLowerCase() === normalizedEmail
      );
      if (!customer) continue;

      // Remove customer, their cards, and their redemptions
      db.customers = db.customers.filter((c) => c.id !== customer.id);
      db.customerCards = db.customerCards.filter((cc) => cc.customerId !== customer.id);
      db.redemptions = db.redemptions.filter((r) => r.customerId !== customer.id);

      const p = dbPath(tenantId);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, JSON.stringify(db, null, 2));
    }
  }

  // 2. Delete client account from client-accounts.json
  const accountsPath = path.join(process.cwd(), "data", "client-accounts.json");
  try {
    const accounts = getAllClientAccounts();
    const filtered = accounts.filter(
      (a) => a.email.toLowerCase() !== normalizedEmail
    );
    fs.mkdirSync(path.dirname(accountsPath), { recursive: true });
    fs.writeFileSync(accountsPath, JSON.stringify(filtered, null, 2));
  } catch { /* account may not exist */ }

  // 3. Delete reset tokens for this client
  try {
    const tokens = readResetTokens();
    const filtered = tokens.filter(
      (t) => !(t.email.toLowerCase() === normalizedEmail && t.type === "client")
    );
    writeResetTokens(filtered);
  } catch { /* tokens may not exist */ }

  // 4. Supprimer sessions, index et cookie
  deleteAllClientSessions(normalizedEmail);
  indexRemoveAllForEmail(normalizedEmail);
  const response = NextResponse.json({ ok: true });
  response.cookies.set("comeback_client", "", { maxAge: 0, path: "/" });

  return response;
}
