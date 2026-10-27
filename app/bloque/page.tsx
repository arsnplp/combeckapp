"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Lock, Loader2 } from "lucide-react";
import PlanChooser from "@/components/billing/PlanChooser";

/**
 * Page des comptes sans abonnement actif. Il n'y a plus de plan gratuit : un
 * compte arrive ici s'il n'a pas encore démarré son essai (inscription dont la
 * page de paiement a été fermée), si son essai résilié est arrivé à terme, ou
 * si son abonnement est arrêté. Le compte n'est PAS supprimé : c'est la seule
 * page accessible tant qu'un essai ou un plan n'a pas été pris, et tout est
 * restauré ensuite.
 */
interface Upsell { eligible: boolean; percentOff?: number; customerCount?: number; }

export default function BlockedPage() {
  const [checked, setChecked] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [upsell, setUpsell] = useState<Upsell | null>(null);
  // Essai jamais pris : le compte vient d'être créé, on lui propose de le
  // démarrer plutôt que de lui annoncer qu'il est « terminé ».
  const [trialAvailable, setTrialAvailable] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/billing/trial")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setTrialAvailable(d?.status === "available"))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Offre « premier mois à -50 % » : c'est ici qu'elle compte le plus, le
    // commerçant étant face au mur. L'éligibilité vient du serveur.
    fetch("/api/upsell")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setUpsell(d))
      .catch(() => {});
  }, []);

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
              {trialAvailable ? "Activez votre essai gratuit" : "Votre compte est en pause"}
            </h1>
            <p className="mt-2 max-w-md text-[14px] leading-relaxed text-slate-500">
              {trialAvailable ? (
                <>
                  30 jours avec toutes les fonctionnalités Business.{" "}
                  <strong>0 € aujourd&apos;hui</strong>, carte demandée pour la suite, résiliable
                  en un clic avant la fin.
                </>
              ) : (
                <>
                  Votre compte, vos clients, vos cartes et toutes vos données sont
                  <strong> conservés</strong>. Choisissez un plan pour tout retrouver
                  exactement comme vous l&apos;avez laissé.
                </>
              )}
            </p>

            {/* Offre de reprise : le moment où le commerçant décide s'il reste */}
            {upsell?.eligible && (
              <div className="mt-7 w-full max-w-md overflow-hidden rounded-2xl bg-gradient-to-br from-green-600 to-emerald-700 px-6 py-5 text-left text-white shadow-lg shadow-green-900/20">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-inset ring-white/25">
                    <span className="text-[17px] font-black leading-none">−{upsell.percentOff ?? 50}%</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold">Merci d&apos;avoir essayé ComeBack</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-green-50/90">
                      {upsell.customerCount && upsell.customerCount > 0 ? (
                        <>
                          Vous avez déjà <strong className="font-semibold text-white">{upsell.customerCount} client
                          {upsell.customerCount > 1 ? "s" : ""} fidélisé{upsell.customerCount > 1 ? "s" : ""}</strong>.
                          Pour continuer avec eux, on vous offre {upsell.percentOff ?? 50} % sur votre premier mois.
                        </>
                      ) : (
                        <>On vous offre <strong className="font-semibold text-white">{upsell.percentOff ?? 50} % sur
                        votre premier mois</strong> pour continuer.</>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowPlans(true)}
              className="mt-8 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-10 py-4 text-[16px] font-bold text-white shadow-xl shadow-green-600/25 transition-all hover:from-green-600 hover:to-emerald-700 active:scale-[0.98]"
            >
              {trialAvailable ? "Démarrer mon essai" : upsell?.eligible ? "En profiter" : "Choisir un plan"}
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
              <h1 className="text-[24px] font-bold text-slate-900">
                {trialAvailable ? "Démarrez votre essai" : "Choisissez votre plan"}
              </h1>
              {upsell?.eligible && (
                <p className="mx-auto mt-2 inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3.5 py-1.5 text-[12.5px] font-semibold text-green-700 ring-1 ring-inset ring-green-200">
                  🎁 {upsell.percentOff ?? 50} % offerts sur votre premier mois — déduit automatiquement
                </p>
              )}
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
