import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Comeback — Programme fidélité digital",
  description: "La plateforme de fidélité numérique pour les commerçants modernes",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  // Manifeste par défaut = espace commerçant (raccourci écran d'accueil →
  // dashboard). L'espace client (app/(client)/layout.tsx) le remplace par
  // le sien — sinon un commerçant qui s'ajoute à l'écran d'accueil depuis
  // son dashboard récupère par erreur le raccourci de connexion client.
  manifest: "/manifest-merchant.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Empêche le zoom automatique iOS au focus d'un champ (le pinch-zoom
  // manuel reste possible, iOS l'autorise toujours pour l'accessibilité)
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
