import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Middleware léger : uniquement authConfig sans bcryptjs/fs
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico).*)"],
};
