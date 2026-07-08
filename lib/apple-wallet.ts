import forge from "node-forge";
import JSZip from "jszip";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { createHash } from "crypto";
import { deflateSync } from "zlib";
import sharp from "sharp";

// ── Minimal solid-colour PNG ──────────────────────────────────────────────────

function solidPNG(width: number, height: number, r: number, g: number, b: number): Buffer {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  function crc32(buf: Buffer): number {
    let crc = 0xffffffff;
    for (const b of buf) crc = (crc >>> 8) ^ table[(crc ^ b) & 0xff];
    return (crc ^ 0xffffffff) >>> 0;
  }
  function chunk(type: string, data: Buffer): Buffer {
    const t = Buffer.from(type, "ascii");
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crc]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const rowBytes = 1 + width * 3;
  const raw = Buffer.alloc(height * rowBytes);
  for (let y = 0; y < height; y++) {
    raw[y * rowBytes] = 0;
    for (let x = 0; x < width; x++) {
      const i = y * rowBytes + 1 + x * 3;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Extract cert + key from P12 ───────────────────────────────────────────────

function extractP12(p12Buffer: Buffer, password: string) {
  const asn1 = forge.asn1.fromDer(p12Buffer.toString("binary"));
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);

  const certBagType = forge.pki.oids.certBag;
  const keyBagType = forge.pki.oids.pkcs8ShroudedKeyBag;
  const certBags = (p12.getBags({ bagType: certBagType })[certBagType] ?? []) as forge.pkcs12.Bag[];
  const keyBags = (p12.getBags({ bagType: keyBagType })[keyBagType] ?? []) as forge.pkcs12.Bag[];

  const signerCert = certBags.find((bag) => {
    if (!bag.cert) return false;
    const bc = (bag.cert.extensions as Array<{ name: string; cA?: boolean }>).find(
      (e) => e.name === "basicConstraints"
    );
    return !bc?.cA;
  })?.cert ?? certBags[0]?.cert;

  const signerKey = keyBags[0]?.key as forge.pki.rsa.PrivateKey | undefined;
  if (!signerCert || !signerKey) throw new Error("Cannot extract certificate or key from P12");
  return { signerCert, signerKey };
}

// ── Background image (360×440 @2x — full card background for generic pass) ────

function hexToRgbParts(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

// Strip image: 750×246px @2x — shown as header band in storeCard pass
async function generateStripImage(opts: ClientPassOptions): Promise<Buffer> {
  const bg = opts.bgColor ?? "#1a0a00";
  const accent = opts.accentColor ?? "#f59e0b";
  const { r, g, b } = hexToRgbParts(bg);
  const bgLighter = `rgb(${Math.min(255,r+35)},${Math.min(255,g+35)},${Math.min(255,b+35)})`;

  const W = 750;
  const H = 246;

  // Subtle radial glow top-right
  const glow = `<circle cx="${W}" cy="0" r="200" fill="${accent}" opacity="0.08"/>`;

  let content = "";
  if (opts.type === "stamps") {
    const total = opts.stampsRequired;  // toujours la valeur réelle de la carte
    const done = Math.min(opts.stamps, total);
    const cols = Math.min(total, 10);
    const rows = Math.ceil(total / cols);
    const cr = rows > 1 ? 20 : 26;
    const gap = rows > 1 ? 12 : 14;
    const gridW = cols * (cr * 2) + (cols - 1) * gap;
    const sx = (W - gridW) / 2;
    const totalH = rows * (cr * 2) + (rows - 1) * gap;
    // Compteur petit en haut, cercles légèrement plus bas
    const counterY = 30;
    const sy = counterY + 38;  // décalé sous le compteur

    const counter = `
      <text x="${W/2}" y="${counterY}"
        text-anchor="middle" font-size="22" font-weight="600"
        fill="${accent}" opacity="0.7"
        font-family="-apple-system,system-ui,sans-serif">${done} / ${total}</text>`;

    const circles = Array.from({ length: total }).map((_, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = sx + col * (cr * 2 + gap) + cr;
      const cy = sy + row * (cr * 2 + gap) + cr;
      const filled = i < done;
      const checkmark = filled ? `<path d="M ${cx-cr*0.35} ${cy} L ${cx-cr*0.05} ${cy+cr*0.35} L ${cx+cr*0.4} ${cy-cr*0.3}"
          stroke="${bg}" stroke-width="${cr * 0.18}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : "";
      return `<circle cx="${cx}" cy="${cy}" r="${cr}"
          fill="${filled ? accent : "none"}"
          stroke="${accent}" stroke-width="2"
          opacity="${filled ? 1 : 0.35}"/>
        ${checkmark}`;
    }).join("\n");

    void totalH;
    content = counter + circles;
  } else {
    // Points mode: show large points number centered
    content = `
      <text x="${W/2}" y="${H/2 - 10}" text-anchor="middle"
        font-size="80" font-weight="700" fill="${accent}"
        font-family="-apple-system,system-ui,BlinkMacSystemFont,sans-serif"
        opacity="0.95">${opts.points.toLocaleString("fr-FR")}</text>
      <text x="${W/2}" y="${H/2 + 38}" text-anchor="middle"
        font-size="28" font-weight="500" fill="white"
        font-family="-apple-system,system-ui,sans-serif"
        opacity="0.5">points</text>`;
  }

  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bgLighter}"/>
        <stop offset="100%" stop-color="${bg}"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#sg)"/>
    ${glow}
    ${content}
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ── Pass JSON ─────────────────────────────────────────────────────────────────

export interface ClientPassOptions {
  type: "stamps" | "points";
  clientName: string;
  clientId: string;
  customerCardId?: string;   // QR encodes /process/[customerCardId] when set
  passOrigin?: string;       // e.g. "http://192.168.1.14:3000"
  stamps: number;
  stampsRequired: number;
  points: number;
  nextReward: string;
  storeName: string;
  accentColor?: string;
  bgColor?: string;
  // Apple Wallet Web Service (push updates)
  serialNumber?: string;
  authenticationToken?: string;
  webServiceURL?: string;    // must be HTTPS in production
  campaignMessage?: string;  // shown in backFields + triggers changeMessage notification
}

function toRgbStr(hex: string): string {
  const { r, g, b } = hexToRgbParts(hex);
  return `rgb(${r}, ${g}, ${b})`;
}

function buildPassJSON(opts: ClientPassOptions): object {
  const bg = opts.bgColor ? toRgbStr(opts.bgColor) : "rgb(26, 10, 0)";
  const accent = opts.accentColor ? toRgbStr(opts.accentColor) : "rgb(245, 158, 11)";

  const serialNumber = opts.serialNumber ?? `${opts.clientId}-${Date.now()}`;

  const base: Record<string, unknown> = {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID ?? "pass.comeback",
    teamIdentifier: process.env.APPLE_TEAM_ID ?? "92VGB6WMXZ",
    serialNumber,
    organizationName: opts.storeName,
    description: `Carte Fidélité — ${opts.storeName}`,
    backgroundColor: bg,
    foregroundColor: "rgb(255, 255, 255)",
    labelColor: accent,
    logoText: opts.storeName,
    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: opts.customerCardId && opts.passOrigin
          ? `${opts.passOrigin}/process/${opts.customerCardId}`
          : opts.clientId,
        messageEncoding: "iso-8859-1",
      },
    ],
  };

  // Web service fields — only include when both are present (requires HTTPS URL)
  if (opts.webServiceURL && opts.authenticationToken) {
    base.webServiceURL = opts.webServiceURL;
    base.authenticationToken = opts.authenticationToken;
  }

  // Message de campagne : affiché en header sur le devant (sans changeMessage —
  // iOS ignore les changeMessage des headerFields), ET en backField AVEC
  // changeMessage : c'est lui qui déclenche la bannière de notification iOS.
  const campaignHeaderField = opts.campaignMessage
    ? [{ key: "campaign", label: "OFFRE", value: opts.campaignMessage }]
    : [];
  const campaignBackField = opts.campaignMessage
    ? [{ key: "campaignBack", label: "Offre en cours", value: opts.campaignMessage, changeMessage: "%@" }]
    : [];

  const auxiliaryFields: Record<string, string>[] = [];
  if (opts.nextReward) {
    auxiliaryFields.push({ key: "reward", label: "PROCHAIN CADEAU", value: opts.nextReward });
  }

  if (opts.type === "stamps") {
    return {
      ...base,
      storeCard: {
        headerFields: campaignHeaderField,
        primaryFields: [{ key: "stamps", label: "", value: " " }],
        secondaryFields: [{ key: "client", label: "CLIENT", value: opts.clientName }],
        ...(auxiliaryFields.length > 0 ? { auxiliaryFields } : {}),
        backFields: [
          // La valeur change à chaque tampon → iOS affiche la notification
          {
            key: "solde",
            label: "Tampons",
            value: `${opts.stamps} / ${opts.stampsRequired}`,
            changeMessage: "Tampons : %@",
          },
          ...campaignBackField,
          {
            key: "info",
            label: "Programme Fidélité",
            value: `Collectez ${opts.stampsRequired} tampons et obtenez votre récompense. Présentez ce QR code à chaque visite.`,
          },
        ],
      },
    };
  }

  return {
    ...base,
    storeCard: {
      headerFields: campaignHeaderField,
      primaryFields: [{ key: "points", label: "", value: " " }],
      secondaryFields: [{ key: "client", label: "CLIENT", value: opts.clientName }],
      ...(auxiliaryFields.length > 0 ? { auxiliaryFields } : {}),
      backFields: [
        // La valeur change à chaque mouvement de points → notification iOS
        {
          key: "solde",
          label: "Points",
          value: `${opts.points.toLocaleString("fr-FR")} points`,
          changeMessage: "Solde : %@",
        },
        ...campaignBackField,
        {
          key: "info",
          label: "Programme Fidélité",
          value: "Accumulez des points à chaque visite et échangez-les contre des récompenses exclusives.",
        },
      ],
    },
  };
}

// ── PKCS#7 detached CMS signature ────────────────────────────────────────────

function signManifest(
  manifest: Buffer,
  signerCert: forge.pki.Certificate,
  signerKey: forge.pki.rsa.PrivateKey,
  wwdrCert: forge.pki.Certificate
): Buffer {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifest.toString("binary"));
  p7.addCertificate(signerCert);
  p7.addCertificate(wwdrCert);
  p7.addSigner({
    key: forge.pki.privateKeyToPem(signerKey),
    certificate: signerCert,
    digestAlgorithm: forge.pki.oids.sha1,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
      { type: forge.pki.oids.messageDigest },
    ],
  });
  p7.sign({ detached: true });
  return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), "binary");
}

// ── Core ZIP builder ──────────────────────────────────────────────────────────

async function buildPkpass(passJson: object, stripImage?: Buffer): Promise<Buffer> {
  const p12Path = path.join(
    process.cwd(),
    process.env.APPLE_P12_PATH ?? "certificates/comeback-wallet.p12"
  );
  const { signerCert, signerKey } = extractP12(
    readFileSync(p12Path),
    process.env.APPLE_P12_PASSWORD ?? ""
  );
  const wwdrCert = forge.pki.certificateFromPem(
    readFileSync(path.join(process.cwd(), "certificates/wwdr.pem"), "utf8")
  );

  // Use uploaded logo if available, otherwise fall back to solid color
  const logoPath = path.join(process.cwd(), "data", "logo.png");
  const hasLogo = existsSync(logoPath);
  const logoBuffer = hasLogo ? readFileSync(logoPath) : null;

  const icon   = logoBuffer ?? solidPNG(29, 29, 37, 99, 235);
  const icon2x = logoBuffer ?? solidPNG(58, 58, 37, 99, 235);
  const logo   = logoBuffer ?? solidPNG(160, 50, 37, 99, 235);
  const logo2x = logoBuffer ?? solidPNG(320, 100, 37, 99, 235);

  const files: Record<string, Buffer> = {
    "pass.json":   Buffer.from(JSON.stringify(passJson, null, 2)),
    "icon.png":    icon,
    "icon@2x.png": icon2x,
    "logo.png":    logo,
    "logo@2x.png": logo2x,
  };

  if (stripImage) {
    files["strip.png"] = stripImage;
    files["strip@2x.png"] = stripImage;
  }

  const manifest: Record<string, string> = {};
  for (const [name, content] of Object.entries(files)) {
    manifest[name] = createHash("sha1").update(content).digest("hex");
  }
  const manifestBuffer = Buffer.from(JSON.stringify(manifest));
  const signature = signManifest(manifestBuffer, signerCert, signerKey, wwdrCert);

  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  zip.file("manifest.json", manifestBuffer);
  zip.file("signature", signature);
  return zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
}

// ── Public exports ────────────────────────────────────────────────────────────

export async function generateClientPass(opts: ClientPassOptions): Promise<Buffer> {
  const [passJson, stripImage] = await Promise.all([
    Promise.resolve(buildPassJSON(opts)),
    generateStripImage(opts).catch(() => undefined),
  ]);
  return buildPkpass(passJson, stripImage);
}
