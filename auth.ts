import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { getUserByEmail, getUserById, createUserFromGoogle } from "@/lib/users";
import { consumeImpersonateToken } from "@/lib/impersonate-tokens";
import { checkRateLimit, getIp } from "@/lib/rate-limit";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {
        email:            { label: "Email",            type: "email" },
        password:         { label: "Password",         type: "password" },
        impersonateToken: { label: "Impersonate Token", type: "text" },
        adminRestoreToken:{ label: "Admin Restore Token", type: "text" },
      },
      async authorize(credentials, request) {
        // ── Rate limiting sur le login restaurant ────────────────────────────
        const ip = request ? getIp(request as unknown as { headers: { get(n: string): string | null } }) : "unknown";
        if (!checkRateLimit(`restaurant-login:${ip}`, 10, 15 * 60 * 1000)) {
          return null; // NextAuth renvoie CredentialsSignin — l'UI affiche "Trop de tentatives"
        }

        // ── Restauration admin après impersonation ───────────────────────────
        const adminRestoreToken = credentials?.adminRestoreToken as string | undefined;
        if (adminRestoreToken) {
          const userId = consumeImpersonateToken(adminRestoreToken);
          if (userId !== "__admin__") return null;
          const email = process.env.ADMIN_EMAIL?.trim() ?? "";
          return { id: "admin", email, name: "Super Admin" };
        }

        // ── Impersonation (admin only, token-based) ──────────────────────────
        const impersonateToken = credentials?.impersonateToken as string | undefined;
        if (impersonateToken) {
          const userId = consumeImpersonateToken(impersonateToken);
          if (!userId) return null;
          const user = getUserById(userId);
          if (!user) return null;
          return { id: user.id, email: user.email, name: user.storeName, impersonatedBy: "admin" };
        }

        // ── Login normal ─────────────────────────────────────────────────────
        const email    = (credentials?.email as string ?? "").toLowerCase().trim();
        const password = credentials?.password as string ?? "";
        if (!email || !password) return null;

        // Admin via env vars
        if (email === process.env.ADMIN_EMAIL?.trim().toLowerCase()) {
          const adminPass = process.env.ADMIN_PASSWORD?.trim();
          if (!adminPass || password !== adminPass) return null;
          return { id: "admin", email, name: "Super Admin" };
        }

        // Utilisateurs normaux
        const user = getUserByEmail(email);
        if (!user) return null;
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;
        // Block unverified restaurants (treat missing field as true for backward compat)
        if (user.emailVerified === false) return null;
        return { id: user.id, email: user.email, name: user.storeName };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user, account }) {
      if (account?.provider === "google" && user?.email) {
        // Google sign-in : trouver ou créer le compte marchand
        const dbUser = getUserByEmail(user.email) ?? createUserFromGoogle(user.email, user.name ?? "");
        token.id = dbUser.id;
        token.isAdmin = false;
      } else if (user) {
        // Credentials sign-in
        token.id = user.id;
        token.isAdmin = user.id === "admin";
        const u = user as { impersonatedBy?: string };
        if (u.impersonatedBy) token.impersonatedBy = u.impersonatedBy;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.isAdmin = token.isAdmin as boolean;
        if (token.impersonatedBy) {
          session.user.impersonatedBy = token.impersonatedBy as string;
        }
      }
      return session;
    },
  },
});
