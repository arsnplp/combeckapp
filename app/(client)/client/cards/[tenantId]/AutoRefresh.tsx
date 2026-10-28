"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Rafraîchit la carte (tampons, points, récompenses) sans action du client :
// toutes les 10 s tant que la page est visible, et tout de suite quand elle
// le redevient (retour dans l'app, téléphone déverrouillé). Avant, la page
// interrogeait le serveur en continu, même en arrière-plan.
export default function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") router.refresh(); };
    const id = setInterval(tick, 10_000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [router]);
  return null;
}
