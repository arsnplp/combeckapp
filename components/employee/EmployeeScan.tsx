"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Camera, X, Loader2, Stamp, Star, Search, CheckCircle,
  ChevronRight, LogOut, AlertCircle,
} from "lucide-react";
import { identifyScan, scanPayload } from "@/lib/scan-code";

function vibrate(p: number | number[]) { try { navigator.vibrate?.(p); } catch { /* ignoré */ } }

interface Cust { id: string; name: string; email: string; phone: string }
interface CustCard { id: string; customerId: string; cardId: string; stamps: number; points: number }
interface LoyaltyCard { id: string; name: string; loyaltyMode: string; stampsRequired?: number; pointsPerEuro?: number }

// ── Caméra (même mécanique que le scanner commerçant, allégée) ──────────────
function Cam({ onDetected, onClose, hint }: { onDetected: (raw: string) => void; onClose: () => void; hint: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const doneRef = useRef(false);
  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting");

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (videoRef.current) videoRef.current.srcObject = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const hit = useCallback((raw: string) => {
    if (doneRef.current) return;
    doneRef.current = true;
    vibrate(60); stop(); onDetected(raw);
  }, [stop, onDetected]);

  const frame = useCallback(async () => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c || v.readyState < 2) { rafRef.current = requestAnimationFrame(frame); return; }
    const vw = v.videoWidth, vh = v.videoHeight;
    c.width = vw; c.height = vh;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    try {
      // @ts-expect-error BarcodeDetector est propre à Chromium
      if (typeof BarcodeDetector !== "undefined") {
        // @ts-expect-error idem
        const d = new BarcodeDetector({ formats: ["qr_code"] });
        const r = await d.detect(c);
        if (r.length > 0) { hit(r[0].rawValue as string); }
      } else {
        const { default: jsQR } = await import("jsqr");
        const full = ctx.getImageData(0, 0, vw, vh);
        let code = jsQR(full.data, vw, vh, { inversionAttempts: "dontInvert" });
        if (!code) {
          const side = Math.floor(Math.min(vw, vh) * 0.8);
          const crop = ctx.getImageData(Math.floor((vw - side) / 2), Math.floor((vh - side) / 2), side, side);
          code = jsQR(crop.data, side, side, { inversionAttempts: "dontInvert" });
        }
        if (code) hit(code.data);
      }
    } catch { /* image illisible : on retente */ }
    if (!doneRef.current) rafRef.current = requestAnimationFrame(frame);
  }, [hit]);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) { setStatus("error"); return; }
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false,
    }).then((s) => {
      if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play().catch(() => {});
        setStatus("scanning");
        rafRef.current = requestAnimationFrame(frame);
      }
    }).catch(() => setStatus("error"));
    return () => { cancelled = true; stop(); };
  }, [frame, stop]);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-black">
      <div className="relative aspect-square">
        <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-44 w-44 rounded-2xl ring-2 ring-white/40" />
        </div>
        <button onClick={() => { stop(); onClose(); }}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white">
          <X className="h-4 w-4" />
        </button>
        {status === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-white/70" />
          </div>
        )}
      </div>
      <p className="px-4 py-3 text-center text-[12px] text-white/80">
        {status === "error"
          ? "Caméra inaccessible — utilisez la recherche par nom ci-dessous."
          : hint}
      </p>
    </div>
  );
}

export default function EmployeeScan({ storeName }: { storeName: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "camera">("idle");

  // Client sélectionné (par scan ou recherche)
  const [cust, setCust] = useState<Cust | null>(null);
  const [cc, setCc] = useState<CustCard | null>(null);
  const [card, setCard] = useState<LoyaltyCard | null>(null);
  const [qty, setQty] = useState(1);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");

  // Recherche manuelle
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ customers: Cust[]; customerCards: CustCard[]; loyaltyCards?: LoyaltyCard[] } | null>(null);

  const reset = () => { setCust(null); setCc(null); setCard(null); setQty(1); setAmount(""); setError(""); setDone(""); };

  const loadCard = async (ccId: string) => {
    setError("");
    try {
      const res = await fetch(`/api/register?ccId=${encodeURIComponent(ccId)}`);
      const d = await res.json();
      if (!res.ok) { setError(d?.error ?? "Carte introuvable."); return; }
      setCc(d.customerCard); setCust(d.customer); setCard(d.loyaltyCard); setQty(1);
    } catch { setError("Erreur réseau."); }
  };

  /**
   * Un seul scanner : carte du client ou récompense, c'est reconnu tout seul.
   * L'employé n'a plus à choisir le bon mode avant de viser — au comptoir,
   * se tromper d'onglet donnait un scan qui « ne marche pas ».
   */
  const onDetected = (raw: string) => {
    setMode("idle");
    const kind = identifyScan(raw);
    if (kind === "reward") { validateReward(scanPayload(raw, "reward")); return; }
    if (kind === "credit") {
      let path = raw.trim();
      try { path = new URL(path).pathname; } catch { /* déjà un chemin ou un id */ }
      const m = path.match(/^\/process\/(.+)$/);
      loadCard(m ? m[1] : raw.trim());
      return;
    }
    setError("QR non reconnu — scannez la carte du client ou son QR de récompense.");
  };

  const search = async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) { setResults(null); return; }
    try {
      const res = await fetch(`/api/register?q=${encodeURIComponent(q.trim())}`);
      setResults(await res.json());
    } catch { /* ignoré */ }
  };

  const remaining = card?.stampsRequired && cc ? Math.max(0, card.stampsRequired - cc.stamps) : 99;
  const isStamps = card?.loyaltyMode === "stamps";
  const euros = parseFloat(amount.replace(",", "."));
  const pts = !isNaN(euros) && euros > 0 ? Math.round(euros * (card?.pointsPerEuro ?? 1)) : 0;

  const credit = async () => {
    if (!cc || busy) return;
    setBusy(true); setError("");
    try {
      const body = isStamps
        // Quantité envoyée telle quelle : le serveur relit la carte et
        // plafonne lui-même. Tronquer ici faisait confiance à un solde chargé
        // avant une éventuelle récompense et créditait moins que demandé.
        ? { action: "stamp", customerCardId: cc.id, count: qty }
        : { action: "points", customerCardId: cc.id, points: pts, euros };
      const res = await fetch("/api/register", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) { setError(d?.error ?? "Enregistrement impossible."); setBusy(false); return; }
      vibrate([30, 40, 30]);
      setDone(isStamps
        ? `+${d?.added ?? qty} tampon${(d?.added ?? qty) > 1 ? "s" : ""} ajouté${(d?.added ?? qty) > 1 ? "s" : ""} !`
        : `+${pts} points ajoutés !`);
    } catch { setError("Erreur réseau."); }
    setBusy(false);
  };

  const validateReward = async (token: string) => {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/client/scan", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) { setError(d?.error ?? "QR invalide."); setBusy(false); return; }
      vibrate([30, 40, 30]);
      setDone(`${d?.rewardEmoji ?? "🎁"} ${d?.rewardName ?? "Récompense"} validée !`);
    } catch { setError("Erreur réseau."); }
    setBusy(false);
  };

  const quit = async () => {
    await fetch("/api/employee/lock", { method: "POST" }).catch(() => {});
    router.push("/employe");
  };

  // ── Écran de confirmation ──
  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <p className="text-[17px] font-bold text-gray-900">{done}</p>
        {cust && <p className="text-[13px] text-gray-500">{cust.name}</p>}
        <button onClick={() => { reset(); setMode("camera"); }}
          className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 text-[14px] font-semibold text-white active:scale-[0.98]">
          <Camera className="h-4 w-4" /> Scanner le client suivant
        </button>
        <button onClick={reset} className="text-[13px] text-gray-400 underline">Terminer</button>
      </div>
    );
  }

  return (
    <div>
      {/* En-tête commerce */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-[13px] font-bold text-white">
          {storeName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-gray-900">{storeName}</p>
          <p className="text-[12px] text-gray-400">Mode employé</p>
        </div>
        <button onClick={quit} className="flex items-center gap-1 text-[12px] text-gray-400 hover:text-gray-700">
          <LogOut className="h-3.5 w-3.5" /> Quitter
        </button>
      </div>

      {error && (
        <p className="mb-3 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[12.5px] text-red-600">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}

      {/* ── Client sélectionné : créditer ── */}
      {cc && cust ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-[15px] font-bold text-gray-900">{cust.name}</p>
          <p className="mb-4 text-[12.5px] text-gray-400">
            {isStamps ? `${cc.stamps}/${card?.stampsRequired ?? 0} tampons` : `${cc.points} points`}
          </p>

          {isStamps ? (
            remaining <= 0 ? (
              <p className="rounded-xl bg-amber-50 px-3 py-3 text-center text-[13px] font-medium text-amber-700">
                Carte pleine — scannez son QR de récompense.
              </p>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-center gap-4">
                  <button onClick={() => setQty((n) => Math.max(1, n - 1))} disabled={qty <= 1}
                    className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 text-xl font-bold text-gray-600 disabled:opacity-30">−</button>
                  <div className="min-w-[70px] text-center">
                    <p className="text-[34px] font-bold leading-none text-gray-900">{qty}</p>
                    <p className="mt-1 text-[11px] text-gray-400">tampon{qty > 1 ? "s" : ""}</p>
                  </div>
                  <button onClick={() => setQty((n) => Math.min(remaining, n + 1))} disabled={qty >= remaining}
                    className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 text-xl font-bold text-gray-600 disabled:opacity-30">+</button>
                </div>
                <button onClick={credit} disabled={busy}
                  className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 text-[15px] font-semibold text-white active:scale-[0.98] disabled:opacity-50">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Stamp className="h-4 w-4" /> Valider</>}
                </button>
              </>
            )
          ) : (
            <>
              <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder="Montant payé (€)"
                className="mb-3 h-14 w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 text-2xl font-bold text-gray-900 outline-none focus:border-slate-400" />
              {pts > 0 && <p className="mb-3 text-center text-[13px] text-gray-500">= <strong>{pts} points</strong></p>}
              <button onClick={credit} disabled={busy || pts <= 0}
                className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 text-[15px] font-semibold text-white active:scale-[0.98] disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Star className="h-4 w-4" /> Valider</>}
              </button>
            </>
          )}
          <button onClick={reset} className="mt-3 w-full text-[12.5px] text-gray-400 underline">Changer de client</button>
        </div>
      ) : mode === "camera" ? (
        <Cam onDetected={onDetected}
          onClose={() => setMode("idle")}
          hint="Carte du client ou récompense" />
      ) : (
        <button onClick={() => { setError(""); setMode("camera"); }}
          className="flex h-16 w-full items-center justify-center gap-2.5 rounded-2xl bg-slate-900 text-[16px] font-bold text-white shadow-lg active:scale-[0.99]">
          <Camera className="h-5 w-5" />
          Scanner
        </button>
      )}

      {/* Recherche manuelle (crédit uniquement) */}
      {!cc && (
        <div className="mt-5">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={query} onChange={(e) => search(e.target.value)} placeholder="ou chercher par nom…"
              className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-[14px] outline-none focus:border-slate-400" />
          </div>
          {results && results.customers.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {results.customers.slice(0, 6).map((c) => {
                const theirCards = results.customerCards.filter((x) => x.customerId === c.id);
                return theirCards.map((x) => {
                  const lc = results.loyaltyCards?.find((l) => l.id === x.cardId);
                  return (
                    <button key={x.id}
                      onClick={() => { setCust(c); setCc(x); setCard(lc ?? null); setQty(1); setQuery(""); setResults(null); }}
                      className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 text-left">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-semibold text-gray-900">{c.name}</p>
                        <p className="text-[11.5px] text-gray-400">
                          {lc?.loyaltyMode === "points" ? `${x.points} pts` : `${x.stamps} tampons`}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                    </button>
                  );
                });
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
