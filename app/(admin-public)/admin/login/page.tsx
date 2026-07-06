"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Zap, Shield, Loader2, Eye, EyeOff } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error || !res?.ok) {
      setError("Identifiants incorrects.");
    } else {
      window.location.href = "/admin";
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
      <div className="w-full max-w-[360px]">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-600">
            <Zap className="h-6 w-6 text-white" fill="currentColor" />
          </div>
          <div>
            <p className="text-[18px] font-bold text-white">Comeback</p>
            <div className="mt-1 flex items-center justify-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1">
              <Shield className="h-3 w-3 text-amber-400" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">Accès Super Admin</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Email</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@exemple.com"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-2.5 text-[14px] text-white outline-none placeholder:text-slate-600 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Mot de passe</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.05] py-2.5 pl-4 pr-10 text-[14px] text-white outline-none placeholder:text-slate-600 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Connexion…" : "Accéder au panneau admin"}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-slate-600">
          Cet accès est réservé à l&apos;administrateur Comeback
        </p>
      </div>
    </div>
  );
}
