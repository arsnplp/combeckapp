import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import type { PlanId } from "@/types";

const USERS_PATH = path.join(process.cwd(), "data", "users.json");

export interface DbUser {
  id: string;
  email: string;
  passwordHash: string;
  passwordPlain?: string;
  storeName: string;
  city?: string;
  plan: PlanId;
  createdAt: string;
  emailVerified?: boolean;
  emailVerificationToken?: string | null;
  googleId?: string;
  onboardingNeeded?: boolean;
}

function read(): DbUser[] {
  try {
    return JSON.parse(fs.readFileSync(USERS_PATH, "utf8"));
  } catch {
    return [];
  }
}

function write(users: DbUser[]) {
  const tmp = USERS_PATH + ".tmp";
  fs.mkdirSync(path.dirname(USERS_PATH), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(users, null, 2));
  fs.renameSync(tmp, USERS_PATH);
}

export function getUserByEmail(email: string): DbUser | null {
  return read().find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export function getUserById(id: string): DbUser | null {
  return read().find((u) => u.id === id) ?? null;
}

export function getAllUsers(): DbUser[] {
  return read();
}

export function getUserByVerificationToken(token: string): DbUser | null {
  return read().find((u) => u.emailVerificationToken === token) ?? null;
}

export function setEmailVerified(id: string): void {
  const users = read();
  const idx = users.findIndex((u) => u.id === id);
  if (idx < 0) return;
  users[idx].emailVerified = true;
  users[idx].emailVerificationToken = null;
  write(users);
}

export function deleteUser(id: string): void {
  const users = read().filter((u) => u.id !== id);
  write(users);
}

export async function updateUserPassword(id: string, newPassword: string): Promise<void> {
  const users = read();
  const idx = users.findIndex((u) => u.id === id);
  if (idx < 0) throw new Error("USER_NOT_FOUND");
  users[idx].passwordHash = await bcrypt.hash(newPassword, 12);
  users[idx].passwordPlain = newPassword;
  write(users);
}

export function createUserFromGoogle(email: string, name: string): DbUser {
  const users = read();
  const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) return existing;
  const user: DbUser = {
    id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    email: email.toLowerCase().trim(),
    passwordHash: "",
    storeName: "",
    plan: "starter",
    createdAt: new Date().toISOString(),
    emailVerified: true,
    googleId: email.toLowerCase().trim(),
    onboardingNeeded: true,
  };
  users.push(user);
  write(users);
  return user;
}

export function completeOnboarding(id: string, storeName: string, city?: string): void {
  const users = read();
  const idx = users.findIndex((u) => u.id === id);
  if (idx < 0) return;
  users[idx].storeName = storeName.trim();
  if (city?.trim()) users[idx].city = city.trim();
  users[idx].onboardingNeeded = false;
  write(users);
}

export async function createUser(
  email: string,
  password: string,
  storeName: string,
  plan: PlanId = "starter",
  city?: string,
): Promise<DbUser> {
  const users = read();
  if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("EMAIL_EXISTS");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const verificationToken = randomBytes(32).toString("hex");
  const user: DbUser = {
    id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    email: email.toLowerCase().trim(),
    passwordHash,
    storeName: storeName.trim(),
    city: city?.trim(),
    plan,
    createdAt: new Date().toISOString(),
    emailVerified: false,
    emailVerificationToken: verificationToken,
  };
  users.push(user);
  write(users);
  return user;
}
