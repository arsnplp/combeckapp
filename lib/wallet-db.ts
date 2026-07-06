import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "wallet-db.json");

export interface WalletPass {
  id: string;
  serialNumber: string;
  authenticationToken: string;
  customerId: string;
  customerCardId: string;
  passTypeIdentifier: string;
  updatedAt: string;
  campaignMessage?: string;
  passData: {
    type: "stamps" | "points";
    clientName: string;
    clientId: string;
    stampsRequired: number;
    nextReward: string;
    storeName: string;
    accentColor: string;
    bgColor: string;
    passOrigin: string;
  };
}

export interface WalletDevice {
  id: string;
  deviceLibraryIdentifier: string;
  pushToken: string;
  passId: string;
  registeredAt: string;
}

interface WalletDbShape {
  passes: WalletPass[];
  devices: WalletDevice[];
}

function read(): WalletDbShape {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    return { passes: [], devices: [] };
  }
}

function write(data: WalletDbShape) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export function walletDb_upsertPass(pass: WalletPass): void {
  const data = read();
  const idx = data.passes.findIndex((p) => p.id === pass.id);
  if (idx >= 0) data.passes[idx] = pass;
  else data.passes.push(pass);
  write(data);
}

export function walletDb_getPass(id: string): WalletPass | null {
  return read().passes.find((p) => p.id === id) ?? null;
}

export function walletDb_getPassBySerial(serialNumber: string): WalletPass | null {
  return read().passes.find((p) => p.serialNumber === serialNumber) ?? null;
}

export function walletDb_getPassByCustomerCard(customerCardId: string): WalletPass | null {
  return read().passes.find((p) => p.customerCardId === customerCardId) ?? null;
}

export function walletDb_getPassByToken(authenticationToken: string): WalletPass | null {
  return read().passes.find((p) => p.authenticationToken === authenticationToken) ?? null;
}

export function walletDb_touchPass(passId: string): string {
  const data = read();
  const idx = data.passes.findIndex((p) => p.id === passId);
  const now = new Date().toISOString();
  if (idx >= 0) {
    data.passes[idx].updatedAt = now;
    write(data);
  }
  return now;
}

export function walletDb_setCampaignMessage(passId: string, message: string): void {
  const data = read();
  const idx = data.passes.findIndex((p) => p.id === passId);
  if (idx >= 0) {
    data.passes[idx].campaignMessage = message;
    data.passes[idx].updatedAt = new Date().toISOString();
    write(data);
  }
}

export function walletDb_getAllPasses(): WalletPass[] {
  return read().passes;
}

export function walletDb_registerDevice(device: WalletDevice): boolean {
  const data = read();
  const exists = data.devices.some(
    (d) => d.deviceLibraryIdentifier === device.deviceLibraryIdentifier && d.passId === device.passId
  );
  if (!exists) {
    data.devices.push(device);
    write(data);
  }
  return !exists; // true = newly created
}

export function walletDb_unregisterDevice(deviceLibraryIdentifier: string, passId: string): boolean {
  const data = read();
  const before = data.devices.length;
  data.devices = data.devices.filter(
    (d) => !(d.deviceLibraryIdentifier === deviceLibraryIdentifier && d.passId === passId)
  );
  if (data.devices.length !== before) { write(data); return true; }
  return false;
}

export function walletDb_getDevicesForPass(passId: string): WalletDevice[] {
  return read().devices.filter((d) => d.passId === passId);
}

export function walletDb_getPassesForDevice(
  deviceLibraryIdentifier: string,
  passTypeIdentifier: string,
  updatedSince?: string
): WalletPass[] {
  const data = read();
  const passIds = new Set(
    data.devices
      .filter((d) => d.deviceLibraryIdentifier === deviceLibraryIdentifier)
      .map((d) => d.passId)
  );
  return data.passes.filter((p) => {
    if (!passIds.has(p.id)) return false;
    if (p.passTypeIdentifier !== passTypeIdentifier) return false;
    if (updatedSince) return new Date(p.updatedAt) > new Date(updatedSince);
    return true;
  });
}
