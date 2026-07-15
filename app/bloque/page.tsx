"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Lock, Loader2 } from "lucide-react";
import PlanChooser from "@/components/billing/PlanChooser";

/**
 * Page de blocage fin d'essai : le compte n'est PAS supprimé, mais c'est la
 * seule page accessible tant qu'un plan n'a pas été choisi. Tout est restauré
 * au paiement.
 */
export default function BlockedPage() {
  const [checked, setChecked] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/plan-features")
      .then((r) => {
        if (r.status === 401) { router.replace("/login"); return null; }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        // Pas bloqué (essai encore actif ou plan payant) → retour au dashboard
        if (!(d.plan === "free" && d.isExpired)) { router.replace("/dashboard"); return; }
        setChecked(true);
      })
      .catch(() => setChecked(true));
  }, [router]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-200">
        <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-200 px-4 py-12">
      <div className="mx-auto max-w-4xl">
        {!showPlans ? (
          /* ── Écran gris : un seul bouton ── */
          <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-300">
              <Lock className="h-8 w-8 text-slate-500" />
            </div>
            <h1 className="mt-6 text-[26px] font-bold text-slate-800">
              Votre essai gratuit est terminé
            </h1>
            <p className="mt-2 max-w-md text-[14px] leading-relaxed text-slate-500">
              Votre compte, vos clients, vos cartes et toutes vos données sont
              <strong> conservés</strong>. Choisissez un plan pour tout retrouver
              exactement comme vous l&apos;avez laissé.
            </p>
            <button
              onClick={() => setShowPlans(true)}
              className="mt-8 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-10 py-4 text-[16px] font-bold text-white shadow-xl shadow-green-600/25 transition-all hover:from-green-600 hover:to-emerald-700 active:scale-[0.98]"
            >
              Choisir un plan
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="mt-6 text-[11.5px] text-slate-400 underline hover:text-slate-600"
            >
              Se déconnecter
            </button>
          </div>
        ) : (
          /* ── Choix du plan (même page) ── */
          <div className="rounded-3xl bg-white p-6 shadow-xl sm:p-8">
            <div className="mb-6 text-center">
              <h1 className="text-[24px] font-bold text-slate-900">Choisissez votre plan</h1>
              <p className="mt-1.5 text-[13.5px] text-slate-500">
                Paiement sécurisé Stripe — votre compte est réactivé immédiatement après le paiement.
              </p>
            </div>
            <PlanChooser />
          </div>
        )}
      </div>
    </div>
  );
}
