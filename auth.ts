import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { getUserByEmail, getUserById, createUserFromGoogle } from "@/lib/users";
import { consumeImpersonateToken } from "@/lib/impersonate-tokens";
import { checkRateLimit, getIp } from "@/lib/rate-limit";
import { timingSafeEqual } from "crypto";

/**
 * Comptes super-admin, déclarés en variables d'environnement.
 *
 * Le premier utilise ADMIN_EMAIL / ADMIN_PASSWORD, les suivants ajoutent un
 * suffixe : ADMIN_EMAIL_2 / ADMIN_PASSWORD_2, _3, etc. Des paires numérotées
 * plutôt qu'une liste à parser : un mot de passe peut contenir n'importe quel
 * caractère, y compris le séparateur qu'on aurait choisi.
 *
 * Tous ouvrent la même identité (`id: "admin"`) : le reste de l'app reconnaît
 * l'administrateur à cet identifiant, et l'email réel est conservé dans la
 * session pour savoir lequel s'est connecté.
 */
function adminAccounts(): Array<{ email: string; password: string }> {
  const accounts: Array<{ email: string; password: string }> = [];
  for (const suffix of ["", "_2", "_3", "_4", "_5"]) {
    const email = process.env[`ADMIN_EMAIL${suffix}`]?.trim().toLowerCase();
    const password = process.env[`ADMIN_PASSWORD${suffix}`]?.trim();
    if (email && password) accounts.push({ email, password });
  }
  return accounts;
}

/**
 * Comparaison à durée constante : une comparaison `!==` classique s'arrête au
 * premier caractère différent, ce qui laisse mesurer la progression d'une
 * tentative. Les longueurs sont comparées à part car `timingSafeEqual` exige
 * des tampons de même taille.
 */
function passwordMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

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
          const user = await getUserById(userId);
          if (!user) return null;
          return { id: user.id, email: user.email, name: user.storeName, impersonatedBy: "admin" };
        }

        // ── Login normal ─────────────────────────────────────────────────────
        const email    = (credentials?.email as string ?? "").toLowerCase().trim();
        const password = credentials?.password as string ?? "";
        if (!email || !password) return null;

        // Admin via variables d'environnement (un ou plusieurs comptes)
        const adminAccount = adminAccounts().find((a) => a.email === email);
        if (adminAccount) {
          if (!passwordMatches(password, adminAccount.password)) return null;
          return { id: "admin", email: adminAccount.email, name: "Super Admin" };
        }

        // Utilisateurs normaux
        const user = await getUserByEmail(email);
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
    async jwt({ token, user, account }) {
      if (account?.provider === "google" && user?.email) {
        // Google sign-in : trouver ou créer le compte marchand
        const existing = await getUserByEmail(user.email);
        const dbUser = existing ?? (await createUserFromGoogle(user.email, user.name ?? ""));
        // Attribution affilié (cookie posé par /ref/{code}) : uniquement à la
        // création du compte — même logique que /api/auth/signup, sinon un
        // filleul qui s'inscrit via Google ne rapporte jamais rien à l'affilié.
        if (!existing) {
          try {
            const { cookies } = await import("next/headers");
            const affiliateCode = (await cookies()).get("comeback_ref")?.value;
            if (affiliateCode) {
              const { supabase } = await import("@/lib/supabase");
              await supabase().from("merchants").update({ affiliate_code: affiliateCode }).eq("id", dbUser.id);
            }
          } catch (e) {
            console.error("[auth] attribution affilié (google)", e);
          }
        }
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
