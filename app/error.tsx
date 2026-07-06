"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-900/40">
        <span className="text-2xl">⚠</span>
      </div>
      <h1 className="text-xl font-bold text-white">Une erreur est survenue</h1>
      <p className="mt-2 text-sm text-slate-400">
        Quelque chose s&apos;est mal passé. Réessayez ou contactez le support.
      </p>
      {error.digest && (
        <p className="mt-1 font-mono text-[11px] text-slate-600">#{error.digest}</p>
      )}
      <div className="mt-8 flex gap-3">
        <button
          onClick={reset}
          className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700"
        >
          Réessayer
        </button>
        <Link
          href="/"
          className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
        >
          Accueil
        </Link>
      </div>
    </div>
  );
}
