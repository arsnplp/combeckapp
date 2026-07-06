import { NextRequest, NextResponse } from "next/server";
import os from "os";

export async function GET(req: NextRequest) {
  const port = new URL(req.url).port || "3000";

  // Find first non-internal IPv4 address
  let ip = "localhost";
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        ip = iface.address;
        break;
      }
    }
    if (ip !== "localhost") break;
  }

  return NextResponse.json({ origin: `http://${ip}:${port}` });
}
