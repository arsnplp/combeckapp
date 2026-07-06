import { NextResponse } from "next/server";
import { auth } from "@/auth";
import fs from "fs";
import path from "path";
import { db_getAll } from "@/lib/server-db";
import { indexAddCustomer } from "@/lib/client-index";

export async function POST() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const tenantsDir = path.join(process.cwd(), "data", "tenants");
  if (!fs.existsSync(tenantsDir)) {
    return NextResponse.json({ ok: true, rebuilt: 0 });
  }

  // Effacer l'index existant et le reconstruire proprement
  const indexPath = path.join(process.cwd(), "data", "client-index.json");
  if (fs.existsSync(indexPath)) fs.unlinkSync(indexPath);

  let count = 0;
  for (const tenantId of fs.readdirSync(tenantsDir)) {
    const db = db_getAll(tenantId);
    for (const customer of db.customers) {
      if (customer.email) {
        indexAddCustomer(customer.email, tenantId);
        count++;
      }
    }
  }

  return NextResponse.json({ ok: true, rebuilt: count });
}
