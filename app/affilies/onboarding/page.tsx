"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Link2, CreditCard, Clock, Banknote, Target } from "lucide-react";

const GOALS = [
  { id: "side", emoji: "💶", label: "Un complément de revenu", desc: "Quelques commerces de mon entourage" },
  { id: "network", emoji: "🤝", label: "Rentabiliser mon réseau", desc: "Je côtoie beaucoup de commerçants (fournisseur, agence, caisse…)" },
  { id: "pro", emoji: "🚀", label: "En faire une vraie activité", desc: "Objectif 25+ commerces, tiers Gold/Platinum" },
];

const TIERS_DISPLAY = [
  { emoji: "🥉", name: "Bronze", range: "0 – 100 € / mois générés", commission: "20 %", cls: "border-orange-200 bg-orange-50/50" },
  { emoji: "🥇", name: "Gold", range: "100 – 500 € / mois générés", commission: "35 %", cls: "border-amber-300 bg-amber-50/60" },
  { emoji: "💎", name: "Platinum", range: "500 € et + / mois générés", commission: "50 %", cls: "border-violet-300 bg-violet-50/60" },
];

export default function AffiliateOnboarding() {
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await fetch("/api/affiliates/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: goal ? (GOALS.find((g) => g.id === goal)?.label ?? goal) : null,
          onboarded: true,
        }),
      });
    } catch { /* non bloquant */ }
    router.push("/affilies/dashboard");
  };

  return (
    <div className="mx-auto max-w-lg">
      {/* Étapes */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 bg-green-600" : i < step ? "w-4 bg-green-300" : "w-4 bg-gray-200"}`} />
        ))}
      </div>

      {/* ── Étape 1 : Comment ça marche ── */}
      {step === 0 && (
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-gray-900">Bienvenue dans le programme partenaires 🎉</h1>
          <p className="mt-1.5 text-[14px] text-gray-500">Voici comment vous allez gagner de l'argent avec ComeBack.</p>

          <div className="mt-8 space-y-4">
            {[
              { icon: Link2, title: "1. Partagez votre lien unique", desc: "Chaque partenaire a un lien personnel (et un QR code). Envoyez-le aux commerçants de votre réseau : restaurants, salons, boutiques…" },
              { icon: CreditCard, title: "2. Le commerce s'abonne", desc: "Il découvre ComeBack, prend son essai gratuit puis paie son abonnement (19 à 99 €/mois). Il est automatiquement rattaché à vous." },
              { icon: Clock, title: "3. Vous touchez 20 à 50 % à chaque paiement", desc: "La commission arrive dans votre cagnotte « en attente » pendant 18 jours (période de garantie anti-remboursement), puis devient disponible." },
              { icon: Banknote, title: "4. Vous retirez quand vous voulez", desc: "Dès 20 € de disponible : virement, Wise ou PayPal. Demande en un clic, paiement sous 2-3 jours." },
            ].map((s) => (
              <div key={s.title} className="flex gap-4 rounded-2xl border border-gray-100 bg-white p-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-green-50">
                  <s.icon className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-gray-900">{s.title}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-gray-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => setStep(1)}
            className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gray-900 text-[14px] font-semibold text-white hover:bg-gray-800 active:scale-[0.98] transition-all">
            Continuer <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Étape 2 : Objectifs ── */}
      {step === 1 && (
        <div>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-green-600" />
            <h1 className="text-[24px] font-bold tracking-tight text-gray-900">Quel est votre objectif ?</h1>
          </div>
          <p className="mt-1.5 text-[14px] text-gray-500">
            Ça nous aide à vous accompagner (et à vous proposer les bons avantages).
          </p>

          <div className="mt-8 space-y-3">
            {GOALS.map((g) => (
              <button key={g.id} onClick={() => setGoal(g.id)}
                className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.99] ${goal === g.id ? "border-green-500 bg-green-50/60" : "border-gray-100 bg-white hover:border-gray-200"}`}>
                <span className="text-[24px]">{g.emoji}</span>
                <div>
                  <p className="text-[14px] font-semibold text-gray-900">{g.label}</p>
                  <p className="text-[12px] text-gray-500">{g.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <button onClick={() => setStep(2)} disabled={!goal}
            className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gray-900 text-[14px] font-semibold text-white hover:bg-gray-800 disabled:opacity-40 transition-all">
            Continuer <ArrowRight className="h-4 w-4" />
          </button>
          <button onClick={() => setStep(2)} className="mt-2 w-full text-center text-[12px] text-gray-400 underline">
            Passer cette étape
          </button>
        </div>
      )}

      {/* ── Étape 3 : Les paliers ── */}
      {step === 2 && (
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-gray-900">Plus vos clients paient, plus vous gagnez 📈</h1>
          <p className="mt-1.5 text-[14px] text-gray-500">
            Votre palier dépend de ce que vos clients actifs paient chaque mois. Simple.
          </p>

          <div className="mt-8 space-y-3">
            {TIERS_DISPLAY.map((t) => (
              <div key={t.name} className={`flex items-center justify-between rounded-2xl border-2 p-5 ${t.cls}`}>
                <div>
                  <p className="text-[17px] font-bold text-gray-900">{t.emoji} {t.name}</p>
                  <p className="mt-0.5 text-[12.5px] text-gray-500">{t.range}</p>
                </div>
                <p className="text-[26px] font-bold text-gray-900">{t.commission}</p>
              </div>
            ))}
          </div>

          <p className="mt-4 rounded-xl bg-gray-100 px-4 py-3 text-[12.5px] leading-relaxed text-gray-500">
            Exemple : vos clients paient 250 € / mois au total → vous êtes <strong>Gold</strong> et touchez
            <strong> 35 %</strong> de chaque paiement, soit 87,50 € / mois.
          </p>

          <button onClick={finish} disabled={saving}
            className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-600 text-[14px] font-semibold text-white hover:bg-green-700 active:scale-[0.98] disabled:opacity-60 transition-all">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Récupérer mon lien partenaire <ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      )}
    </div>
  );
}
