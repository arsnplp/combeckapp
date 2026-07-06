import http2 from "http2";
import forge from "node-forge";
import { readFileSync, existsSync } from "fs";
import path from "path";
import {
  walletDb_getDevicesForPass,
  walletDb_getPassByCustomerCard,
  walletDb_getPass,
  walletDb_touchPass,
  walletDb_setCampaignMessage,
  walletDb_getAllPasses,
} from "./wallet-db";
import { db_getAll, findTenantByCustomerCardId } from "./server-db";
import { generateClientPass } from "./apple-wallet";
import { updateGoogleWalletObject } from "./google-wallet";

// ── Certificate cache ─────────────────────────────────────────────────────────

let _pemCache: { certChainPem: string; keyPem: string } | null = null;

function getPemFromP12(): { certChainPem: string; keyPem: string } {
  if (_pemCache) return _pemCache;

  const p12Path = path.join(
    process.cwd(),
    process.env.APPLE_P12_PATH ?? "certificates/comeback-wallet.p12"
  );
  const password = process.env.APPLE_P12_PASSWORD ?? "";

  const asn1 = forge.asn1.fromDer(readFileSync(p12Path).toString("binary"));
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);

  const certBagType = forge.pki.oids.certBag;
  const keyBagType = forge.pki.oids.pkcs8ShroudedKeyBag;

  const certBags = (p12.getBags({ bagType: certBagType })[certBagType] ?? []) as forge.pkcs12.Bag[];
  const keyBags = (p12.getBags({ bagType: keyBagType })[keyBagType] ?? []) as forge.pkcs12.Bag[];

  if (!certBags.length || !keyBags.length) throw new Error("Cannot extract cert/key from P12");

  // Log cert info for debugging
  for (const bag of certBags) {
    if (!bag.cert) continue;
    const cn = bag.cert.subject.getField("CN")?.value ?? "unknown";
    const expiry = bag.cert.validity.notAfter.toISOString();
    console.log(`[APNs] Cert: CN=${cn}, expires=${expiry}`);
  }

  // Send FULL chain (leaf + WWDR intermediate) — APNs requires the complete chain
  const certChainPem = certBags
    .filter((bag) => bag.cert)
    .map((bag) => forge.pki.certificateToPem(bag.cert!))
    .join("");

  const signerKey = keyBags[0].key as forge.pki.rsa.PrivateKey;

  _pemCache = {
    certChainPem,
    keyPem: forge.pki.privateKeyToPem(signerKey),
  };
  return _pemCache;
}

// ── APNs push ─────────────────────────────────────────────────────────────────

async function sendApnsPush(pushToken: string): Promise<void> {
  const { certChainPem, keyPem } = getPemFromP12();
  // Pass Type ID certificates are ALWAYS production — never use sandbox endpoint
  const host = "api.push.apple.com";
  const topic = process.env.APPLE_PASS_TYPE_ID ?? "pass.comeback";

  console.log(`[APNs] Connecting to ${host}, topic=${topic}`);

  return new Promise<void>((resolve, reject) => {
    const client = http2.connect(`https://${host}`, {
      cert: Buffer.from(certChainPem),
      key: Buffer.from(keyPem),
    });

    client.on("error", (err) => {
      console.error(`[APNs] Connection error:`, err.message);
      client.close();
      reject(err);
    });

    // Wait for the HTTP/2 SETTINGS handshake before sending any stream
    client.once("connect", () => {
      const body = "{}";
      const req = client.request({
        ":method": "POST",
        ":path": `/3/device/${pushToken}`,
        "apns-topic": topic,
        "apns-expiration": "0",
        "apns-priority": "5",
        "content-type": "application/json",
        "content-length": String(Buffer.byteLength(body)),
      });

      req.write(body);
      req.end();

      req.on("response", (headers) => {
        const status = headers[":status"] as number;
        let responseBody = "";
        req.on("data", (chunk) => { responseBody += chunk; });
        req.on("end", () => {
          console.log(`[APNs] Status: ${status}${responseBody ? ` body: ${responseBody}` : ""}`);
          client.close();
          if (status === 200) resolve();
          else reject(new Error(`APNs HTTP ${status}: ${responseBody}`));
        });
      });

      req.on("error", (err) => {
        console.error(`[APNs] Stream error:`, err.message);
        client.close();
        reject(err);
      });
    });
  });
}

// ── Pass regeneration ─────────────────────────────────────────────────────────

export async function regeneratePass(passId: string): Promise<Buffer | null> {
  const walletPass = walletDb_getPass(passId);
  if (!walletPass) return null;

  const found = findTenantByCustomerCardId(walletPass.customerCardId);
  const cc = found?.card ?? undefined;

  const opts = walletPass.passData;

  // Lire les paramètres à jour depuis settings.json (stampsRequired, couleurs, nom)
  let stampsRequired = opts.stampsRequired;
  let accentColor = opts.accentColor;
  let bgColor = opts.bgColor;
  let storeName = opts.storeName;
  let nextReward = opts.nextReward;
  if (found) {
    try {
      const settingsPath = path.join(process.cwd(), "data", "tenants", found.tenantId, "settings.json");
      const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
      const lc = (settings.loyaltyCards ?? []).find((c: { id: string }) => c.id === cc?.cardId);
      if (lc) {
        stampsRequired = lc.stampsRequired ?? stampsRequired;
        accentColor = lc.accentColor ?? accentColor;
        bgColor = lc.backgroundColor ?? bgColor;
      }
      storeName = settings.settings?.storeName ?? storeName;
    } catch { /* garde les valeurs sauvegardées */ }
  }

  return generateClientPass({
    type: opts.type,
    clientName: opts.clientName,
    clientId: walletPass.customerId,
    customerCardId: walletPass.customerCardId,
    passOrigin: opts.passOrigin,
    stamps: cc?.stamps ?? 0,
    stampsRequired,
    points: cc?.points ?? 0,
    nextReward,
    storeName,
    accentColor,
    bgColor,
    serialNumber: walletPass.serialNumber,
    authenticationToken: walletPass.authenticationToken,
    webServiceURL: process.env.WALLET_WEB_SERVICE_URL,
    campaignMessage: walletPass.campaignMessage,
  });
}

// ── Push result type ─────────────────────────────────────────────────────────

export interface PushResult {
  pushToken: string;
  success: boolean;
  error?: string;
}

// ── WalletNotificationService ─────────────────────────────────────────────────

export class WalletNotificationService {
  /**
   * Sends an APNs "pass updated" push to every device that has registered this pass.
   * Apple Wallet will call GET /api/wallet/v1/passes/{passTypeId}/{serialNumber} to
   * fetch the freshly-generated .pkpass and update the card on the user's device.
   */
  async sendPassUpdate(passId: string): Promise<PushResult[]> {
    walletDb_touchPass(passId);
    const devices = walletDb_getDevicesForPass(passId);
    console.log(`[Wallet] sendPassUpdate passId=${passId} devices=${devices.length}`);
    const results: PushResult[] = [];

    for (const device of devices) {
      try {
        await sendApnsPush(device.pushToken);
        console.log(`[Wallet] ✓ Push sent to ${device.pushToken.slice(0, 10)}...`);
        results.push({ pushToken: device.pushToken, success: true });
      } catch (err) {
        console.error(`[Wallet] ✗ Push failed:`, String(err));
        results.push({ pushToken: device.pushToken, success: false, error: String(err) });
      }
    }

    return results;
  }

  /**
   * Updates the points counter for the given customerCard and pushes to all
   * registered devices.  The actual points value is read from db.json at
   * regeneration time, so no need to pass it here.
   */
  async updatePoints(customerCardId: string): Promise<PushResult[]> {
    // Apple Wallet
    const pass = walletDb_getPassByCustomerCard(customerCardId);
    const appleResults = pass ? await this.sendPassUpdate(pass.id) : [];

    // Google Wallet
    this._updateGoogle(customerCardId).catch(console.error);

    return appleResults;
  }

  async updateStamps(customerCardId: string): Promise<PushResult[]> {
    // Apple Wallet
    const pass = walletDb_getPassByCustomerCard(customerCardId);
    const appleResults = pass ? await this.sendPassUpdate(pass.id) : [];

    // Google Wallet
    this._updateGoogle(customerCardId).catch(console.error);

    return appleResults;
  }

  private async _updateGoogle(customerCardId: string): Promise<void> {
    const found = findTenantByCustomerCardId(customerCardId);
    if (!found) return;
    const { tenantId, card: cc } = found;
    const db = db_getAll(tenantId);
    const customer = db.customers.find((c) => c.id === cc.customerId);

    let loyaltyMode: "stamps" | "points" = "stamps";
    let stampsRequired = 8;
    try {
      const settingsPath = path.join(process.cwd(), "data", "tenants", tenantId, "settings.json");
      if (existsSync(settingsPath)) {
        const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
        const loyaltyCard = (settings.loyaltyCards ?? []).find((c: { id: string }) => c.id === cc.cardId);
        if (loyaltyCard) {
          loyaltyMode = loyaltyCard.loyaltyMode ?? "stamps";
          stampsRequired = loyaltyCard.stampsRequired ?? 8;
        }
      }
    } catch { /* defaults */ }

    await updateGoogleWalletObject(
      customerCardId,
      loyaltyMode,
      cc.stamps ?? 0,
      stampsRequired,
      cc.points ?? 0,
      customer?.totalVisits ?? 0,
    );
  }

  /**
   * Stores the campaign message on the pass then pushes all registered devices.
   * Apple Wallet fetches the updated pass which includes the message in backFields,
   * and iOS shows a "pass updated" notification.
   */
  async sendCampaign(passId: string, message: string): Promise<PushResult[]> {
    walletDb_setCampaignMessage(passId, message);
    return this.sendPassUpdate(passId);
  }

  /**
   * Sends a campaign to ALL registered passes.
   */
  async sendCampaignToAll(message: string): Promise<PushResult[]> {
    const passes = walletDb_getAllPasses();
    const results: PushResult[] = [];
    for (const pass of passes) {
      const r = await this.sendCampaign(pass.id, message);
      results.push(...r);
    }
    return results;
  }

  async sendCampaignToCustomers(message: string, customerIds: string[]): Promise<PushResult[]> {
    const idSet = new Set(customerIds);
    const passes = walletDb_getAllPasses().filter((p) => idSet.has(p.customerId));
    const results: PushResult[] = [];
    for (const pass of passes) {
      const r = await this.sendCampaign(pass.id, message);
      results.push(...r);
    }
    return results;
  }
}

export const walletNotificationService = new WalletNotificationService();
