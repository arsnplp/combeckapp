import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ComeBack — Mes cartes de fidélité",
    short_name: "ComeBack",
    description: "Retrouvez toutes vos cartes de fidélité, tampons, points et récompenses.",
    start_url: "/client/cards",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#16a34a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
