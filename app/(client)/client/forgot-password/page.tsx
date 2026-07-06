"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, Loader2, CheckCircle } from "lucide-react";

export default function ClientForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      await fetch("/api/client/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      setDone(true);
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-8">
      <Link href="/client/login" className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-800 mb-8 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Retour
      </Link>

      {done ? (
        <div className="text-center py-8">
          <div className="flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-[22px] font-bold text-gray-900 mb-2">Email envoyé !</h1>
          <p className="text-[14px] text-gray-500 max-w-xs mx-auto">
            Si un compte existe pour <strong>{email}</strong>, vous recevrez un lien de réinitialisation.
          </p>
          <p className="mt-3 text-[12px] text-gray-400">Le lien expire dans 1 heure.</p>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <h1 className="text-[24px] font-bold text-gray-900 tracking-tight">Mot de passe oublié</h1>
            <p className="mt-1.5 text-[14px] text-gray-500">
              Entrez votre email pour recevoir un lien de réinitialisation.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                required
                className="w-full pl-10 pr-4 py-3.5 rounded-2xl border border-gray-200 bg-gray-50 text-[14px] text-gray-900 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all"
              />
            </div>

            {error && <p className="text-[12px] text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gray-900 text-white text-[14px] font-semibold hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Envoyer le lien
            </button>
          </form>
        </>
      )}
    </div>
  );
}
