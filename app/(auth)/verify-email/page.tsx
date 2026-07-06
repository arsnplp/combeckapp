"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Zap, Loader2, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";

type Status = "loading" | "success" | "error";

function VerifyEmailContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const errorParam = params.get("error");

  const [status, setStatus] = useState<Status>(errorParam ? "error" : "loading");
  const [errorMessage, setErrorMessage] = useState(
    errorParam === "missing" ? "Lien de vérification invalide." :
    errorParam === "invalid" ? "Ce lien est invalide ou a déjà été utilisé." : ""
  );

  useEffect(() => {
    if (errorParam) return; // already set error state
    if (!token) {
      setStatus("error");
      setErrorMessage("Lien de vérification invalide.");
      return;
    }

    fetch(`/api/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.ok) {
          setStatus("success");
          setTimeout(() => router.push("/login?verified=1"), 2500);
        } else {
          setStatus("error");
          setErrorMessage(data.error ?? "Lien invalide ou expiré.");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMessage("Une erreur est survenue. Veuillez réessayer.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-600">
            <Zap className="h-5 w-5 text-white" fill="currentColor" />
          </div>
        </div>

        {status === "loading" && (
          <>
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-green-600" />
            <h1 className="text-[18px] font-bold text-slate-900">Vérification en cours…</h1>
            <p className="mt-2 text-[13px] text-slate-500">Validation de votre adresse email.</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="mx-auto mb-4 h-10 w-10 text-emerald-500" />
            <h1 className="text-[18px] font-bold text-slate-900">Email vérifié !</h1>
            <p className="mt-2 text-[13px] text-slate-500">
              Votre compte est activé. Redirection vers la connexion…
            </p>
            <Link
              href="/login?verified=1"
              className="mt-5 inline-block rounded-xl bg-green-600 px-6 py-2.5 text-[13px] font-semibold text-white hover:bg-green-700 transition-colors"
            >
              Se connecter
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="mx-auto mb-4 h-10 w-10 text-red-500" />
            <h1 className="text-[18px] font-bold text-slate-900">Échec de la vérification</h1>
            <p className="mt-2 text-[13px] text-slate-500">{errorMessage}</p>
            <div className="mt-5 flex flex-col gap-2">
              <Link
                href="/login"
                className="rounded-xl bg-green-600 px-6 py-2.5 text-[13px] font-semibold text-white hover:bg-green-700 transition-colors"
              >
                Retour à la connexion
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
