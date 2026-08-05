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
  // dashboard). L'espace client (app/(client)/layout.tsx) et l'espace
  // partenaires (app/affilies/layout.tsx) le remplacent chacun par le
  // leur — sinon tout le monde récupère par erreur le raccourci commerçant.
  manifest: "/manifest-merchant.webmanifest",
  // iOS utilise ce titre pour le nom sous l'icône (pas le short_name du
  // manifeste) — sans ça, il reprend le <title> de la page affichée au
  // moment du tap, ce qui donne un nom différent selon où on se trouvait.
  appleWebApp: {
    capable: true,
    title: "ComeBack Pro",
    statusBarStyle: "default",
  },
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
