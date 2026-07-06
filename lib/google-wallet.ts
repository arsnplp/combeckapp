import { SignJWT, importPKCS8 } from "jose";

export interface GoogleWalletPassInput {
  tenantId: string;
  cardId: string;
  customerCardId: string;
  customerName: string;
  storeName: string;
  cardName: string;
  loyaltyMode: "stamps" | "points";
  stamps: number;
  stampsRequired: number;
  points: number;
  totalVisits: number;
  bgColor: string;
  accentColor: string;
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function isConfigured(): boolean {
  return !!(
    process.env.GOOGLE_WALLET_ISSUER_ID &&
    process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_WALLET_PRIVATE_KEY
  );
}

async function getPrivateKey() {
  const raw = process.env.GOOGLE_WALLET_PRIVATE_KEY!;
  return importPKCS8(raw.replace(/\\n/g, "\n"), "RS256");
}

// ── OAuth2 token cache ────────────────────────────────────────────────────────

let _tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt) return _tokenCache.token;

  const email = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL!;
  const privateKey = await getPrivateKey();
  const now = Math.floor(Date.now() / 1000);

  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/wallet_object.issuer",
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .setIssuer(email)
    .setSubject(email)
    .setAudience("https://oauth2.googleapis.com/token")
    .sign(privateKey);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const data = await res.json() as { access_token?: string; expires_in?: number; error?: string };
  if (!data.access_token) throw new Error(`[GoogleWallet] Token exchange failed: ${data.error ?? JSON.stringify(data)}`);

  _tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + ((data.expires_in ?? 3600) - 120) * 1000,
  };
  return _tokenCache.token;
}

// ── Pass generation (fat JWT) ─────────────────────────────────────────────────

export async function buildGoogleWalletUrl(input: GoogleWalletPassInput): Promise<string> {
  if (!isConfigured()) {
    throw new Error("Google Wallet non configuré (GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL, GOOGLE_WALLET_PRIVATE_KEY requis).");
  }

  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID!;
  const email = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL!;
  const privateKey = await getPrivateKey();

  const classId = `${issuerId}.comeback_${sanitizeId(input.tenantId)}_${sanitizeId(input.cardId)}`;
  const objectId = `${issuerId}.${sanitizeId(input.customerCardId)}`;

  const balanceLabel = input.loyaltyMode === "stamps"
    ? `${input.stamps} / ${input.stampsRequired} tampons`
    : `${input.points} points`;

  const loyaltyClass = {
    id: classId,
    issuerName: input.storeName,
    programName: input.cardName,
    reviewStatus: "UNDER_REVIEW",
    hexBackgroundColor: input.bgColor,
    programLogo: {
      sourceUri: { uri: `${process.env.AUTH_URL ?? "https://comeback.nairox.fr"}/api/settings/logo?tenantId=${input.tenantId}` },
      contentDescription: { defaultValue: { language: "fr-FR", value: input.storeName } },
    },
  };

  const loyaltyObject = {
    id: objectId,
    classId,
    state: "ACTIVE",
    accountId: input.customerCardId,
    accountName: input.customerName,
    loyaltyPoints: {
      balance: { string: balanceLabel },
      label: input.loyaltyMode === "stamps" ? "Tampons" : "Points",
    },
    textModulesData: [
      { header: "Visites", body: String(input.totalVisits), id: "visits" },
    ],
    barcode: {
      type: "QR_CODE",
      value: input.customerCardId,
      alternateText: input.customerCardId.slice(-8).toUpperCase(),
    },
  };

  const jwt = await new SignJWT({
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: [process.env.AUTH_URL ?? "https://comeback.nairox.fr"],
    payload: {
      loyaltyClasses: [loyaltyClass],
      loyaltyObjects: [loyaltyObject],
    },
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt()
    .setIssuer(email)
    .sign(privateKey);

  return `https://pay.google.com/gp/v/save/${jwt}`;
}

// ── Live object update via REST API ──────────────────────────────────────────

export async function updateGoogleWalletObject(
  customerCardId: string,
  loyaltyMode: "stamps" | "points",
  stamps: number,
  stampsRequired: number,
  points: number,
  totalVisits: number,
): Promise<void> {
  if (!isConfigured()) return; // Google Wallet non configuré — skip silencieusement

  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID!;
  const objectId = `${issuerId}.${sanitizeId(customerCardId)}`;

  const balanceLabel = loyaltyMode === "stamps"
    ? `${stamps} / ${stampsRequired} tampons`
    : `${points} points`;

  try {
    const accessToken = await getAccessToken();
    const res = await fetch(
      `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${encodeURIComponent(objectId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          loyaltyPoints: {
            balance: { string: balanceLabel },
            label: loyaltyMode === "stamps" ? "Tampons" : "Points",
          },
          textModulesData: [
            { header: "Visites", body: String(totalVisits), id: "visits" },
          ],
        }),
      },
    );

    if (!res.ok && res.status !== 404) {
      // 404 = le client n'a pas encore ajouté la carte Google Wallet — normal
      console.error(`[GoogleWallet] PATCH ${objectId} → ${res.status}`);
    } else if (res.ok) {
      console.log(`[GoogleWallet] ✓ Updated ${objectId}`);
    }
  } catch (err) {
    console.error("[GoogleWallet] update failed:", err);
  }
}
