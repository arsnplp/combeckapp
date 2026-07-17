"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Rafraîchit les compteurs (tampons/points) sans action du client :
// - toutes les 15 s tant que la page est visible
// - immédiatement quand la page redevient visible (retour d'app, déverrouillage)
export default function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") router.refresh(); };
    const interval = setInterval(tick, 15000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [router]);

  return null;
}
