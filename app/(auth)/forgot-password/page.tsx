"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, Loader2, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
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
      await fetch("/api/auth/forgot-password", {
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-slate-800 mb-8 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Retour à la connexion
        </Link>

        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          {done ? (
            <div className="text-center">
              <div className="flex items-center justify-center h-14 w-14 rounded-full bg-green-100 mx-auto mb-4">
                <CheckCircle className="h-7 w-7 text-green-600" />
              </div>
              <h1 className="text-[20px] font-bold text-slate-900 mb-2">Email envoyé !</h1>
              <p className="text-[14px] text-slate-500 mb-6">
                Si un compte existe pour <strong>{email}</strong>, vous recevrez un lien de réinitialisation dans quelques instants.
              </p>
              <p className="text-[12px] text-slate-400">Le lien expire dans 1 heure.</p>
            </div>
          ) : (
            <>
              <h1 className="text-[22px] font-bold text-slate-900 mb-1">Mot de passe oublié</h1>
              <p className="text-[14px] text-slate-500 mb-6">
                Entrez votre email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-[14px] text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
                  />
                </div>

                {error && <p className="text-[12px] text-red-500">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-900 text-white text-[14px] font-semibold hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Envoyer le lien
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
