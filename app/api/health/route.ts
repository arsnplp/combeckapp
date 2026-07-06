import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  const dataDir = path.join(process.cwd(), "data");
  const tenantsDir = path.join(dataDir, "tenants");

  let tenantCount = 0;
  try {
    tenantCount = fs.readdirSync(tenantsDir).length;
  } catch { /* dossier absent */ }

  return NextResponse.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    tenants: tenantCount,
    ts: new Date().toISOString(),
  });
}
