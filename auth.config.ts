import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";

export const authConfig = {
  trustHost: true, // derrière le reverse proxy nginx
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // Mappe token → session.user (nécessaire aussi dans le middleware)
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id ?? token.sub) as string;
        session.user.isAdmin = !!(token.isAdmin);
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAdmin = !!auth?.user?.isAdmin;
      const { pathname } = nextUrl;

      // Pages publiques admin
      if (pathname.startsWith("/admin/login")) return true;

      // Routes admin protégées → redirige vers /admin/login si pas admin
      if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
        if (!isAdmin) return NextResponse.redirect(new URL("/admin/login", nextUrl));
        return true;
      }

      // Pages publiques normales
      const isPublic =
        pathname.startsWith("/login") ||
        pathname.startsWith("/signup") ||
        pathname.startsWith("/tarifs") ||
        pathname.startsWith("/forgot-password") ||
        pathname.startsWith("/reset-password") ||
        pathname.startsWith("/verify-email") ||
        pathname.startsWith("/mentions-legales") ||
        pathname.startsWith("/cgu") ||
        pathname.startsWith("/politique-de-confidentialite") ||
        pathname.startsWith("/join/") ||
        pathname.startsWith("/client") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/register") ||
        pathname.startsWith("/api/wallet") ||
        pathname.startsWith("/api/cron/") ||
        pathname.startsWith("/api/billing/webhook") ||
        pathname.startsWith("/api/settings/logo") ||
        pathname.startsWith("/api/client/login") ||
        pathname.startsWith("/api/client/check-email") ||
        pathname.startsWith("/api/client/logout") ||
        pathname.startsWith("/api/client/set-password") ||
        pathname.startsWith("/api/client/forgot-password") ||
        pathname.startsWith("/api/client/reset-password") ||
        pathname.startsWith("/api/client/cards/wallet") ||
        pathname.startsWith("/api/client/cards") ||
        pathname.startsWith("/api/client/redeem") ||
        pathname.startsWith("/api/client/gdpr") ||
        pathname.startsWith("/api/client/auth/google") ||
        pathname.startsWith("/onboarding") ||
        pathname.startsWith("/api/onboarding") ||
        pathname === "/";

      if (isPublic) return true;
      if (!isLoggedIn) return false;
      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
