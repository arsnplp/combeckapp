import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800">
        <span className="text-2xl font-bold text-slate-400">404</span>
      </div>
      <h1 className="text-xl font-bold text-white">Page introuvable</h1>
      <p className="mt-2 text-sm text-slate-400">
        Cette page n&apos;existe pas ou a été déplacée.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/"
          className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700"
        >
          Accueil
        </Link>
        <Link
          href="/login"
          className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
        >
          Se connecter
        </Link>
      </div>
    </div>
  );
}
