"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bricolage_Grotesque } from "next/font/google";
import {
  Mail, Lock, User, Phone, Store, ArrowRight, Loader2,
  Link2, Wallet, CheckCircle2, Sparkles, ChevronLeft,
} from "lucide-react";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "600", "700", "800"] });

const inputClass =
  "w-full h-12 pl-10 pr-4 rounded-xl border border-green-900/10 bg-white text-[14px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all";

// ── Notifications de commissions (héros) ──
const NOTIFS = [
  { amount: "+34,65 €", from: "Institut Beauté Chloé", delay: "0.15s" },
  { amount: "+9,80 €", from: "Coiffure Léa", delay: "0.35s" },
  { amount: "+49,50 €", from: "Food truck El Patron", delay: "0.55s" },
];

// ── Témoignages ──
const AVIS = [
  {
    initials: "KB", name: "Karim B.", role: "Commercial CHR, Lyon",
    monthly: "450 € / mois", clients: "9 commerces parrainés",
    text: "Je visite des restaurants toute la journée pour mon boulot. Je leur montre ComeBack en 2 minutes sur mon téléphone, la carte dans le wallet fait le reste. C'est devenu un vrai deuxième salaire.",
  },
  {
    initials: "JM", name: "Julie M.", role: "Esthéticienne à domicile, Bordeaux",
    monthly: "200 € / mois", clients: "5 commerces parrainés",
    text: "J'ai commencé par équiper mon propre institut, puis j'en ai parlé à mes copines coiffeuses et à mon ongleur. Chaque mois ça tombe, sans rien faire de plus.",
  },
  {
    initials: "TR", name: "Thomas R.", role: "Étudiant, Paris",
    monthly: "120 € / mois", clients: "3 commerces parrainés",
    text: "Le kebab en bas de chez moi, mon barbier et un café. Trois QR codes collés, et je touche ma commission tous les mois. Objectif : passer Gold avant l'été.",
  },
];

// ── Paliers ──
const PALIERS = [
  { emoji: "🥉", name: "Bronze", range: "0 – 100 € / mois générés", rate: "20 %", cls: "" },
  { emoji: "🥇", name: "Gold", range: "100 – 500 € / mois générés", rate: "35 %", cls: "ring-2 ring-amber-300/60" },
  { emoji: "💎", name: "Platinum", range: "500 € et + / mois générés", rate: "50 %", cls: "ring-2 ring-violet-300/60" },
];

// ── Qui parrainer ──
const CIBLES = ["💅 Esthéticiennes", "✂️ Coiffeurs", "🚚 Food trucks", "🍕 Restaurants", "☕ Cafés", "🥖 Boulangeries", "💪 Salles de sport", "🌸 Fleuristes"];

const SLIDE_COUNT = 5;
const SLIDE_LABELS = ["Le programme", "Comment ça marche", "Vos gains", "Ils le font déjà", "Inscription"];

export default function AffiliateSignupPage() {
  const [name, setName] = useState("");
  const [commerce, setCommerce] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const trackRef = useRef<HTMLDivElement>(null);
  const [slide, setSlide] = useState(0);

  const goTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const next = Math.max(0, Math.min(SLIDE_COUNT - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };

  const onScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setSlide(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (password.length < 8) { setError("Mot de passe : minimum 8 caractères."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/affiliates/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, commerce, email, phone, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.error ?? "Erreur."); setLoading(false); return; }
      router.push("/affilies/onboarding");
    } catch {
      setError("Erreur réseau.");
      setLoading(false);
    }
  };

  return (
    // Annule le padding du layout pour un carrousel plein écran sous le header
    <div className="-my-8 flex h-[calc(100dvh-56px)] flex-col">
      <style>{`
        @keyframes cbFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes cbPop { 0% { opacity: 0; transform: translateY(10px) scale(.96); } 60% { transform: translateY(-2px) scale(1.01); } 100% { opacity: 1; transform: none; } }
        @keyframes cbFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        .cb-reveal { opacity: 0; animation: cbFadeUp .6s cubic-bezier(.22,.8,.36,1) forwards; }
        .cb-notif { opacity: 0; animation: cbPop .55s cubic-bezier(.22,.8,.36,1) forwards; }
        .cb-float { animation: cbFloat 4s ease-in-out infinite; }
        /* Les deux classes combinées : apparition PUIS flottement (sinon cb-float écrase cbPop et la carte reste invisible) */
        .cb-notif.cb-float { animation: cbPop .55s cubic-bezier(.22,.8,.36,1) forwards, cbFloat 4s ease-in-out 1s infinite; }
        .cb-track::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ═══ PISTE DU CARROUSEL ═══ */}
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="cb-track flex flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none]"
      >
        {/* ── Slide 1 : Héros ── */}
        <section className="w-full flex-shrink-0 snap-center overflow-y-auto px-1 py-4">
          <div className="relative flex min-h-full flex-col justify-center overflow-hidden rounded-3xl bg-gradient-to-b from-green-700 to-green-900 px-6 py-8 text-white sm:px-10">
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-green-400/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-28 -left-16 h-56 w-56 rounded-full bg-emerald-300/15 blur-3xl" />

            <p className="cb-reveal inline-flex w-fit items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11.5px] font-semibold uppercase tracking-wider text-green-100">
              <Sparkles className="h-3 w-3" /> Programme partenaires ComeBack
            </p>

            <h1 className={`${display.className} cb-reveal mt-4 text-[32px] leading-[1.05] sm:text-[42px]`}
              style={{ animationDelay: ".08s", fontWeight: 800 }}>
              Gagnez de l&apos;argent
              <br />
              <span className="relative inline-block">
                tous les mois.
                <svg className="absolute -bottom-1.5 left-0 w-full" viewBox="0 0 200 9" fill="none" preserveAspectRatio="none">
                  <path d="M2 6.5C60 2.5 140 2.5 198 6.5" stroke="#4ade80" strokeWidth="5" strokeLinecap="round" />
                </svg>
              </span>
            </h1>

            <p className="cb-reveal mt-5 max-w-md text-[14.5px] leading-relaxed text-green-50/85" style={{ animationDelay: ".16s" }}>
              Recommandez ComeBack aux commerces autour de vous. À chaque abonnement payé,
              vous touchez <strong className="text-white">20 à 50 % de commission</strong> — chaque mois,
              tant qu&apos;ils restent clients.
            </p>

            {/* Notifications de commissions */}
            <div className="mt-6 flex max-w-sm flex-col gap-2">
              {NOTIFS.map((n, i) => (
                <div key={n.from}
                  className={`cb-notif ${i === 1 ? "cb-float ml-6" : i === 2 ? "ml-2" : ""} flex items-center gap-3 rounded-2xl border border-white/10 bg-white/95 px-4 py-2.5 shadow-lg shadow-green-950/30`}
                  style={{ animationDelay: n.delay }}>
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-100">💸</div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-green-700">{n.amount} <span className="font-medium text-gray-400">de commission</span></p>
                    <p className="truncate text-[11px] text-gray-500">{n.from} vient de payer son abonnement</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="cb-reveal mt-6 text-[11.5px] text-green-100/60" style={{ animationDelay: ".8s" }}>
              Sans engagement · Retrait dès 20 € · Virement, Wise ou PayPal
            </p>
          </div>
        </section>

        {/* ── Slide 2 : Vous connaissez quelqu'un + 3 étapes ── */}
        <section className="w-full flex-shrink-0 snap-center overflow-y-auto px-1 py-4">
          <div className="flex min-h-full flex-col justify-center">
            <h2 className={`${display.className} text-[24px] font-bold leading-tight text-gray-900`}>
              Vous connaissez forcément<br />quelqu&apos;un. 👀
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-gray-600">
              Une esthéticienne, un coiffeur, un food truck… qui aimerait <strong>augmenter son
              chiffre d&apos;affaires</strong>, faire revenir ses clients plus souvent et leur faire plaisir
              avec une vraie carte de fidélité dans leur téléphone.
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-gray-600">
              Proposez-lui ComeBack — et <strong className="text-green-700">soyez récompensé pour la mise en relation</strong>, tous les mois.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {CIBLES.map((c) => (
                <span key={c} className="rounded-full border border-green-200 bg-green-50 px-3.5 py-1.5 text-[12.5px] font-medium text-green-800">
                  {c}
                </span>
              ))}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { icon: Link2, t: "1. Partagez votre lien", d: "Un lien unique + un QR code, à envoyer ou montrer en 30 secondes." },
                { icon: Store, t: "2. Le commerce s'abonne", d: "Essai gratuit, puis abonnement de 19 à 99 €/mois. Il est rattaché à vous." },
                { icon: Wallet, t: "3. Vous encaissez", d: "20 à 50 % de chaque paiement, tous les mois. Retrait dès 20 €." },
              ].map((s) => (
                <div key={s.t} className="rounded-2xl border border-green-900/[0.07] bg-white p-4">
                  <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-green-600">
                    <s.icon className="text-white" style={{ width: 18, height: 18 }} />
                  </div>
                  <p className="text-[13.5px] font-bold text-gray-900">{s.t}</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-gray-500">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Slide 3 : Paliers ── */}
        <section className="w-full flex-shrink-0 snap-center overflow-y-auto px-1 py-4">
          <div className="flex min-h-full flex-col justify-center">
            <h2 className={`${display.className} text-[24px] font-bold text-gray-900`}>
              Plus ils paient, plus vous gagnez.
            </h2>
            <p className="mt-1.5 text-[13.5px] text-gray-500">
              Votre taux dépend de ce que vos commerces actifs paient chaque mois.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {PALIERS.map((p) => (
                <div key={p.name} className={`rounded-2xl border border-green-900/[0.07] bg-white p-5 text-center ${p.cls}`}>
                  <p className="text-[28px]">{p.emoji}</p>
                  <p className={`${display.className} mt-1 text-[17px] font-bold text-gray-900`}>{p.name}</p>
                  <p className="mt-0.5 text-[11.5px] text-gray-400">{p.range}</p>
                  <p className={`${display.className} mt-2 text-[32px] font-bold leading-none text-green-700`}>{p.rate}</p>
                  <p className="text-[11px] text-gray-400">de commission</p>
                </div>
              ))}
            </div>
            <p className="mt-3 rounded-xl bg-green-50 px-4 py-3 text-[12.5px] leading-relaxed text-green-900/70">
              💡 Exemple : vos commerces paient 250 € / mois au total → vous êtes <strong>Gold</strong> et
              touchez <strong>87,50 € chaque mois</strong>, sans rien faire de plus.
            </p>
          </div>
        </section>

        {/* ── Slide 4 : Témoignages ── */}
        <section className="w-full flex-shrink-0 snap-center overflow-y-auto px-1 py-4">
          <div className="flex min-h-full flex-col justify-center">
            <h2 className={`${display.className} text-[24px] font-bold text-gray-900`}>
              Ils le font déjà. 💬
            </h2>
            <div className="mt-5 space-y-3">
              {AVIS.map((a) => (
                <div key={a.name} className="rounded-2xl border border-green-900/[0.07] bg-white p-5">
                  <div className="flex items-center gap-3">
                    <div className={`${display.className} flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-green-700 text-[14px] font-bold text-white`}>
                      {a.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold text-gray-900">{a.name}</p>
                      <p className="text-[11.5px] text-gray-400">{a.role}</p>
                    </div>
                    <div className="text-right">
                      <p className={`${display.className} text-[17px] font-bold leading-none text-green-700`}>{a.monthly}</p>
                      <p className="mt-0.5 text-[10.5px] text-gray-400">{a.clients}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-[13px] leading-relaxed text-gray-600">« {a.text} »</p>
                  <p className="mt-2 text-[12px] tracking-[0.15em] text-amber-400">★★★★★</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Slide 5 : Formulaire ── */}
        <section className="w-full flex-shrink-0 snap-center overflow-y-auto px-1 py-4">
          <div className="flex min-h-full flex-col justify-center">
            <div className="overflow-hidden rounded-3xl border border-green-900/[0.08] bg-white shadow-xl shadow-green-900/[0.06]">
              <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-5">
                <h2 className={`${display.className} text-[20px] font-bold text-white`}>
                  Créez votre compte partenaire
                </h2>
                <p className="mt-0.5 text-[12.5px] text-green-100/80">
                  2 minutes, gratuit, sans engagement. Votre lien vous attend.
                </p>
              </div>

              <form onSubmit={submit} className="space-y-3 p-6">
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Prénom & Nom *" required className={inputClass} />
                </div>
                <div className="relative">
                  <Store className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input value={commerce} onChange={(e) => setCommerce(e.target.value)} placeholder="Votre activité (commercial, esthéticienne, étudiant…) *" required className={inputClass} />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com *" required className={inputClass} />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 XX XX XX XX" className={inputClass} />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe (min. 8 caractères) *" required className={inputClass} />
                </div>

                {error && (
                  <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[13px] text-red-500">{error}</p>
                )}

                <button type="submit" disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 py-4 text-[15px] font-bold text-white shadow-lg shadow-green-600/25 transition-all hover:bg-green-700 active:scale-[0.98] disabled:opacity-50">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Recevoir mon lien partenaire <ArrowRight className="h-4 w-4" /></>}
                </button>

                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-1">
                  {["Gratuit", "Sans engagement", "Paiement sous 2-3 jours"].map((t) => (
                    <span key={t} className="flex items-center gap-1 text-[11.5px] text-gray-400">
                      <CheckCircle2 className="h-3 w-3 text-green-500" /> {t}
                    </span>
                  ))}
                </div>
              </form>
            </div>

            <p className="mt-4 text-center text-[13px] text-gray-500">
              Déjà partenaire ?{" "}
              <Link href="/affilies" className="font-semibold text-green-700 underline">Me connecter</Link>
            </p>
          </div>
        </section>
      </div>

      {/* ═══ NAVIGATION DU CARROUSEL ═══ */}
      <div className="border-t border-gray-100 bg-white/90 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button
            onClick={() => goTo(slide - 1)}
            disabled={slide === 0}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 disabled:opacity-0 active:bg-gray-50 transition-opacity"
            aria-label="Précédent"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="flex flex-1 flex-col items-center gap-1">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`h-1.5 rounded-full transition-all ${i === slide ? "w-6 bg-green-600" : "w-1.5 bg-gray-300"}`}
                  aria-label={SLIDE_LABELS[i]}
                />
              ))}
            </div>
            <p className="text-[10.5px] font-medium text-gray-400">{SLIDE_LABELS[slide]}</p>
          </div>

          {slide < SLIDE_COUNT - 1 ? (
            <button
              onClick={() => goTo(slide + 1)}
              className={`${display.className} flex h-11 flex-shrink-0 items-center gap-1.5 rounded-full bg-green-600 px-5 text-[13.5px] font-bold text-white shadow-md shadow-green-600/25 active:scale-95 transition-transform`}
            >
              {slide === 0 ? "Découvrir" : "Suivant"} <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="w-11 flex-shrink-0" />
          )}
        </div>
        {slide < SLIDE_COUNT - 1 && (
          <button
            onClick={() => goTo(SLIDE_COUNT - 1)}
            className="mx-auto mt-1.5 block text-center text-[11.5px] font-medium text-gray-400 underline-offset-2 hover:underline"
          >
            Passer directement à l&apos;inscription
          </button>
        )}
      </div>
    </div>
  );
}
