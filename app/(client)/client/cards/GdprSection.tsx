"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function GdprSection() {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    if (confirmText !== "SUPPRIMER") return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch("/api/client/gdpr/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      if (res.ok) {
        window.location.href = "/client/login";
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Une erreur est survenue.");
        setDeleting(false);
      }
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="mt-8 rounded-2xl border border-gray-100 bg-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Mes données</p>
        <a
          href="/api/client/gdpr/export"
          download
          className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors mb-2"
        >
          📥 Télécharger mes données
        </a>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="flex w-full items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-[13px] text-red-600 hover:bg-red-100 transition-colors"
        >
          🗑 Supprimer mon compte
        </button>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-[16px] font-bold text-gray-900 mb-2">Supprimer mon compte</h2>
            <p className="text-[13px] text-gray-500 mb-4 leading-relaxed">
              Cette action est <strong>irréversible</strong>. Toutes vos données (cartes de fidélité, points, tampons) seront supprimées de tous les établissements.
            </p>
            <p className="text-[12px] font-semibold text-gray-700 mb-2">
              Tapez <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-red-600">SUPPRIMER</span> pour confirmer :
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="SUPPRIMER"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-[13px] text-gray-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 mb-3"
            />
            {error && (
              <p className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowDeleteModal(false); setConfirmText(""); setError(""); }}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={confirmText !== "SUPPRIMER" || deleting}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 py-2.5 text-[13px] font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
