import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

const ACCOUNTS_PATH = path.join(process.cwd(), "data", "client-accounts.json");

export interface ClientAccount {
  email: string;
  passwordHash: string;
  passwordPlain?: string;
  name: string;
  createdAt: string;
  googleId?: string;
}

function read(): ClientAccount[] {
  try {
    return JSON.parse(fs.readFileSync(ACCOUNTS_PATH, "utf8"));
  } catch {
    return [];
  }
}

function write(accounts: ClientAccount[]) {
  const tmp = ACCOUNTS_PATH + ".tmp";
  fs.mkdirSync(path.dirname(ACCOUNTS_PATH), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(accounts, null, 2));
  fs.renameSync(tmp, ACCOUNTS_PATH);
}

export function getClientAccount(email: string): ClientAccount | null {
  const normalized = email.toLowerCase().trim();
  return read().find((a) => a.email.toLowerCase() === normalized) ?? null;
}

export function getAllClientAccounts(): ClientAccount[] {
  return read();
}

export async function createClientAccount(
  email: string,
  password: string,
  name: string,
): Promise<ClientAccount> {
  const normalized = email.toLowerCase().trim();
  const accounts = read();
  const existing = accounts.findIndex((a) => a.email.toLowerCase() === normalized);
  const passwordHash = await bcrypt.hash(password, 10);
  const account: ClientAccount = {
    email: normalized,
    passwordHash,
    name,
    createdAt: new Date().toISOString(),
  };
  if (existing >= 0) {
    accounts[existing] = account;
  } else {
    accounts.push(account);
  }
  write(accounts);
  return account;
}

export async function verifyClientPassword(email: string, password: string): Promise<boolean> {
  const account = getClientAccount(email);
  if (!account) return false;
  return bcrypt.compare(password, account.passwordHash);
}

export async function resetClientPassword(email: string, newPassword: string): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const accounts = read();
  const idx = accounts.findIndex((a) => a.email.toLowerCase() === normalized);
  const passwordHash = await bcrypt.hash(newPassword, 10);
  if (idx >= 0) {
    accounts[idx].passwordHash = passwordHash;
    accounts[idx].passwordPlain = newPassword;
  } else {
    accounts.push({ email: normalized, passwordHash, passwordPlain: newPassword, name: normalized, createdAt: new Date().toISOString() });
  }
  write(accounts);
}

export function createClientAccountFromGoogle(email: string, name: string): ClientAccount {
  const normalized = email.toLowerCase().trim();
  const accounts = read();
  const existing = accounts.find((a) => a.email.toLowerCase() === normalized);
  if (existing) {
    if (!existing.googleId) {
      existing.googleId = normalized;
      write(accounts);
    }
    return existing;
  }
  const account: ClientAccount = {
    email: normalized,
    passwordHash: "",
    name: name.trim() || normalized,
    createdAt: new Date().toISOString(),
    googleId: normalized,
  };
  accounts.push(account);
  write(accounts);
  return account;
}

export function deleteClientAccount(email: string): void {
  const normalized = email.toLowerCase().trim();
  write(read().filter((a) => a.email.toLowerCase() !== normalized));
}
