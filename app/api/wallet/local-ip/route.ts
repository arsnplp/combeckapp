import { NextRequest, NextResponse } from "next/server";
import os from "os";

export async function GET(req: NextRequest) {
  // Uniquement utile en développement : `useNetworkOrigin` n'appelle cette
  // route que depuis localhost ou une IP privée, pour qu'un téléphone du même
  // WiFi atteigne le serveur. En production elle ne servait plus qu'à publier
  // l'adresse et le port internes du serveur à qui les demandait.
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

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
