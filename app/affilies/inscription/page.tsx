"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, User, Phone, Store, ArrowRight, Loader2 } from "lucide-react";

const inputClass =
  "w-full h-12 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-[14px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-all";

export default function AffiliateSignupPage() {
  const [name, setName] = useState("");
  const [commerce, setCommerce] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

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
    <div className="mx-auto max-w-sm pt-8">
      <h1 className="text-[24px] font-bold tracking-tight text-gray-900">Devenir partenaire</h1>
      <p className="mt-1.5 text-[14px] text-gray-500">
        Gratuit. Vous recevez un lien unique : chaque commerce qui s'abonne via ce lien
        vous rapporte <strong>20 % de commission</strong> sur ses paiements.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-3">
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Prénom & Nom *" required className={inputClass} />
        </div>
        <div className="relative">
          <Store className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={commerce} onChange={(e) => setCommerce(e.target.value)} placeholder="Votre activité / société *" required className={inputClass} />
        </div>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com *" required className={inputClass} />
        </div>
        <div className="relative">
          <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 XX XX XX XX" className={inputClass} />
        </div>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe (min. 8 caractères) *" required className={inputClass} />
        </div>
        {error && (
          <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[13px] text-red-500">{error}</p>
        )}
        <button type="submit" disabled={loading}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gray-900 text-[14px] font-semibold text-white transition-all hover:bg-gray-800 active:scale-[0.98] disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Créer mon compte partenaire <ArrowRight className="h-4 w-4" /></>}
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-gray-500">
        Déjà partenaire ?{" "}
        <Link href="/affilies" className="font-semibold text-green-700 underline">Me connecter</Link>
      </p>
    </div>
  );
}
