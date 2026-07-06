import { NextResponse } from "next/server";
import { auth } from "@/auth";
import fs from "fs";
import path from "path";
import forge from "node-forge";

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const p12Path = process.env.APPLE_P12_PATH;
  const p12Password = process.env.APPLE_P12_PASSWORD ?? "";

  if (!p12Path) {
    return NextResponse.json({ error: "APPLE_P12_PATH non configuré." }, { status: 500 });
  }

  const fullPath = path.isAbsolute(p12Path)
    ? p12Path
    : path.join(process.cwd(), p12Path);

  if (!fs.existsSync(fullPath)) {
    return NextResponse.json({ error: "Fichier .p12 introuvable." }, { status: 404 });
  }

  try {
    const p12Buffer = fs.readFileSync(fullPath);
    const asn1 = forge.asn1.fromDer(p12Buffer.toString("binary"));
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, p12Password);

    const certBagType = forge.pki.oids.certBag;
    const certBags = (p12.getBags({ bagType: certBagType })[certBagType] ?? []) as forge.pkcs12.Bag[];

    // Trouver le certificat Pass Type ID (pas le CA)
    const passCert = certBags.find((bag) => {
      if (!bag.cert) return false;
      const bc = (bag.cert.extensions as Array<{ name: string; cA?: boolean }>).find(
        (e) => e.name === "basicConstraints",
      );
      return !bc?.cA;
    })?.cert ?? certBags[0]?.cert;

    if (!passCert) {
      return NextResponse.json({ error: "Certificat introuvable dans le .p12." }, { status: 500 });
    }

    const expiresAt = passCert.validity.notAfter.toISOString();
    const daysLeft = Math.floor(
      (passCert.validity.notAfter.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    const subject = (passCert.subject.attributes as Array<{ name: string; value: string }>)
      .find((a) => a.name === "commonName")?.value ?? "";

    return NextResponse.json({ expiresAt, daysLeft, subject });
  } catch (e) {
    return NextResponse.json({ error: `Erreur lecture certificat: ${String(e)}` }, { status: 500 });
  }
}
