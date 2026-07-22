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
  nextReward?: string;
  referralCount?: number;
}

function buildTextModules(opts: {
  totalVisits: number;
  nextReward?: string;
  referralCount?: number;
}): Array<{ header: string; body: string; id: string }> {
  const modules = [
    { header: "Visites", body: String(opts.totalVisits), id: "visits" },
  ];
  if (opts.nextReward) {
    modules.push({ header: "Prochain cadeau", body: opts.nextReward, id: "reward" });
  }
  if ((opts.referralCount ?? 0) > 0) {
    modules.push({
      header: "Parrainages",
      body: `${opts.referralCount} filleul${(opts.referralCount ?? 0) > 1 ? "s" : ""}`,
      id: "referral",
    });
  }
  return modules;
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
      sourceUri: { uri: `${process.env.AUTH_URL ?? "https://app.getcomeback.fr"}/api/settings/logo?tenantId=${input.tenantId}` },
      contentDescription: { defaultValue: { language: "fr-FR", value: input.storeName } },
    },
  };

  const appUrl = process.env.AUTH_URL ?? "https://app.getcomeback.fr";

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
    textModulesData: buildTextModules(input),
    // Lien permanent vers l'espace client, affiché sur la carte
    linksModuleData: {
      uris: [
        {
          uri: `${appUrl}/client/cards`,
          description: "Mon compte ComeBack — cartes et récompenses",
          id: "account",
        },
      ],
    },
    // Même format que la carte Apple : le commerçant scanne le QR avec sa caméra
    // et arrive directement sur la page de traitement de la visite.
    barcode: {
      type: "QR_CODE",
      value: `${appUrl}/process/${input.customerCardId}`,
      alternateText: input.customerCardId.slice(-8).toUpperCase(),
    },
  };

  const jwt = await new SignJWT({
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: [process.env.AUTH_URL ?? "https://app.getcomeback.fr"],
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

// ── Messages (campagnes / notifications) ─────────────────────────────────────

/**
 * Ajoute un message sur la carte Google Wallet (équivalent de la notification
 * de campagne Apple). Retourne true si la carte existe (donc client atteint).
 */
export async function addGoogleWalletMessage(
  customerCardId: string,
  header: string,
  body: string,
): Promise<boolean> {
  if (!isConfigured()) return false;
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID!;
  const objectId = `${issuerId}.${sanitizeId(customerCardId)}`;
  try {
    const accessToken = await getAccessToken();
    const res = await fetch(
      `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${encodeURIComponent(objectId)}/addMessage`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            header,
            body,
            id: `msg_${Date.now()}`,
            messageType: "TEXT_AND_NOTIFY", // déclenche une notification push Android
          },
        }),
      },
    );
    if (res.ok) console.log(`[GoogleWallet] ✓ Message envoyé à ${objectId}`);
    return res.ok; // 404 = carte pas ajoutée — normal
  } catch (err) {
    console.error("[GoogleWallet] addMessage failed:", err);
    return false;
  }
}

// ── Expiration (suppression client) ──────────────────────────────────────────

/** Marque la carte Google Wallet comme expirée (client supprimé). */
export async function expireGoogleWalletObject(customerCardId: string): Promise<void> {
  if (!isConfigured()) return;
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID!;
  const objectId = `${issuerId}.${sanitizeId(customerCardId)}`;
  try {
    const accessToken = await getAccessToken();
    const res = await fetch(
      `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${encodeURIComponent(objectId)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ state: "EXPIRED" }),
      },
    );
    if (res.ok) console.log(`[GoogleWallet] ✓ Carte expirée ${objectId}`);
  } catch (err) {
    console.error("[GoogleWallet] expire failed:", err);
  }
}

// ── Mise à jour de la classe (design / nom de la carte) ──────────────────────

/**
 * Répercute les changements de design du commerçant (couleurs, nom) sur
 * toutes les cartes Google Wallet déjà enregistrées de cette carte fidélité.
 */
export async function updateGoogleWalletClass(
  tenantId: string,
  cardId: string,
  opts: { storeName: string; cardName: string; bgColor: string },
): Promise<void> {
  if (!isConfigured()) return;
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID!;
  const classId = `${issuerId}.comeback_${sanitizeId(tenantId)}_${sanitizeId(cardId)}`;
  try {
    const accessToken = await getAccessToken();
    const res = await fetch(
      `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass/${encodeURIComponent(classId)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          issuerName: opts.storeName,
          programName: opts.cardName,
          hexBackgroundColor: opts.bgColor,
        }),
      },
    );
    if (!res.ok && res.status !== 404) {
      // 404 = aucune carte de ce type encore enregistrée — normal
      console.error(`[GoogleWallet] PATCH class ${classId} → ${res.status}`);
    }
  } catch (err) {
    console.error("[GoogleWallet] update class failed:", err);
  }
}

// ── Détection d'ajout ─────────────────────────────────────────────────────────

/**
 * La carte a-t-elle été ajoutée à Google Wallet ?
 * Avec le "fat JWT", l'objet n'est créé chez Google qu'au moment où le client
 * enregistre la carte — son existence vaut donc confirmation d'ajout.
 */
export async function googleWalletObjectExists(customerCardId: string): Promise<boolean> {
  if (!isConfigured()) return false;
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID!;
  const objectId = `${issuerId}.${sanitizeId(customerCardId)}`;
  try {
    const accessToken = await getAccessToken();
    const res = await fetch(
      `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${encodeURIComponent(objectId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ── Live object update via REST API ──────────────────────────────────────────

export interface GoogleWalletUpdateInput {
  customerCardId: string;
  loyaltyMode: "stamps" | "points";
  stamps: number;
  stampsRequired: number;
  points: number;
  totalVisits: number;
  nextReward?: string;
  referralCount?: number;
}

export async function updateGoogleWalletObject(input: GoogleWalletUpdateInput): Promise<void> {
  if (!isConfigured()) return; // Google Wallet non configuré — skip silencieusement

  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID!;
  const objectId = `${issuerId}.${sanitizeId(input.customerCardId)}`;

  const balanceLabel = input.loyaltyMode === "stamps"
    ? `${input.stamps} / ${input.stampsRequired} tampons`
    : `${input.points} points`;

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
            label: input.loyaltyMode === "stamps" ? "Tampons" : "Points",
          },
          textModulesData: buildTextModules(input),
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
