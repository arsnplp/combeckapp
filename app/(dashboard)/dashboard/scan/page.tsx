"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ScanLine, Loader2, CheckCircle2, AlertCircle, Camera, X,
  Plus, Stamp, Star, Search, ChevronRight, CheckCircle, Zap, ZapOff,
} from "lucide-react";

// Retour haptique (silencieusement ignoré si non supporté, ex. iOS Safari)
function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* non supporté */ }
}
import { useStore } from "@/lib/store-context";

// ── Types ────────────────────────────────────────────────────────────────────

type ScanRewardResult =
  | { ok: true; customerName: string; rewardName: string; rewardEmoji: string; costType: string; cost: number }
  | { ok: false; error: string };

interface CustCard { id: string; customerId: string; cardId: string; stamps: number; points: number; }
interface Cust { id: string; name: string; email: string; phone: string; }
interface LoyaltyCard { id: string; name: string; loyaltyMode: string; }
interface SearchResult { customers: Cust[]; customerCards: CustCard[]; loyaltyCards?: LoyaltyCard[]; }

// ── TransactionModal (donner pts/tampons après scan wallet) ──────────────────

function TransactionModal({ customerCardId, onClose, onScanNext }: { customerCardId: string; onClose: () => void; onScanNext?: () => void }) {
  const { customers, customerCards, loyaltyCards, addStampToCard, addPointsToCard, syncFromServer } = useStore();
  const [syncing, setSyncing] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);

  const cc = customerCards.find((c) => c.id === customerCardId);
  const card = cc ? loyaltyCards.find((c) => c.id === cc.cardId) : null;
  const customer = cc ? customers.find((c) => c.id === cc.customerId) : null;
  const [amount, setAmount] = useState("");
  const [done, setDone] = useState<"stamp" | "points" | null>(null);

  useEffect(() => {
    if (!cc && !syncing && !syncFailed) {
      setSyncing(true);
      syncFromServer().finally(() => { setSyncing(false); setSyncFailed(true); });
    }
  }, [cc, syncing, syncFailed, syncFromServer]);

  if (!cc && syncing) return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
      <Loader2 className="h-7 w-7 animate-spin text-green-500 mx-auto mb-2" />
      <p className="text-sm font-semibold text-slate-700">Synchronisation…</p>
    </div>
  );

  if (!cc || !card || !customer) return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
      <p className="font-semibold text-slate-700 mb-1">Carte introuvable</p>
      <p className="text-sm text-slate-400 mb-4">Ce QR ne correspond à aucun client.</p>
      <button onClick={onClose} className="rounded-xl bg-slate-100 px-5 py-2 text-sm font-medium text-slate-600">Fermer</button>
    </div>
  );

  const euros = parseFloat(amount.replace(",", "."));
  const previewPts = !isNaN(euros) && euros > 0 ? Math.round(euros * card.pointsPerEuro) : 0;
  const accent = card.accentColor;
  const bg = card.backgroundColor;

  const doStamp = () => { addStampToCard(cc.id); vibrate([30, 40, 30]); setDone("stamp"); };
  const doPoints = () => { if (previewPts <= 0) return; addPointsToCard(cc.id, previewPts); vibrate([30, 40, 30]); setDone("points"); };

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-5 py-4" style={{ background: bg }}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
            style={{ background: accent, color: "#fff" }}>
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-white">{customer.name}</p>
            <p className="text-xs text-white/60">
              {card.name} · {card.loyaltyMode === "stamps" ? `${cc.stamps}/${card.stampsRequired} tampons` : `${cc.points.toLocaleString("fr-FR")} pts`}
            </p>
          </div>
          <button onClick={onClose} className="ml-auto text-white/60 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="bg-white px-5 py-5">
        {done ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <p className="font-semibold text-slate-800">
              {done === "stamp" ? "+1 tampon ajouté !" : `+${previewPts} points ajoutés !`}
            </p>
            {onScanNext && (
              <button onClick={onScanNext}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 py-3.5 text-sm font-bold text-white shadow-md shadow-green-600/20 active:scale-[0.99]">
                <Camera className="h-4 w-4" /> Scanner le client suivant
              </button>
            )}
            <button onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Fermer
            </button>
          </div>
        ) : card.loyaltyMode === "stamps" ? (
          <>
            <p className="text-sm text-slate-500 mb-4">Ajouter un tampon à la carte de <strong>{customer.name.split(" ")[0]}</strong></p>
            <button onClick={doStamp}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 font-semibold text-white text-sm"
              style={{ background: accent }}>
              <Stamp className="h-4 w-4" /> +1 tampon
            </button>
            <button onClick={onClose} className="mt-2 w-full py-2 text-xs text-slate-400 hover:text-slate-600">Annuler</button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-3">Montant de l'achat pour <strong>{customer.name.split(" ")[0]}</strong></p>
            <div className="relative mb-3">
              <input
                type="number" min="0" step="0.01" inputMode="decimal" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00" autoFocus
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-2xl font-bold text-slate-900 outline-none focus:border-green-400 pr-10"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg text-slate-400">€</span>
            </div>
            {previewPts > 0 && (
              <p className="text-center text-sm text-slate-500 mb-3">= <strong style={{ color: accent }}>{previewPts} points</strong></p>
            )}
            <button onClick={doPoints} disabled={previewPts === 0}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 font-semibold text-white text-sm disabled:opacity-40"
              style={{ background: accent }}>
              <Star className="h-4 w-4" /> Valider {previewPts > 0 ? `+${previewPts} pts` : ""}
            </button>
            <button onClick={onClose} className="mt-2 w-full py-2 text-xs text-slate-400 hover:text-slate-600">Annuler</button>
          </>
        )}
      </div>
    </div>
  );
}

function ClientIdTransactionModal({ clientId, onClose, onScanNext }: { clientId: string; onClose: () => void; onScanNext?: () => void }) {
  const { customers, customerCards, loyaltyCards } = useStore();
  const customer = customers.find((c) => c.id === clientId);
  const cards = customerCards.filter((cc) => cc.customerId === clientId);
  const [selectedCCId, setSelectedCCId] = useState<string | null>(cards.length === 1 ? cards[0].id : null);

  if (!customer) return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
      <p className="font-semibold text-slate-700 mb-1">Client introuvable</p>
      <p className="text-sm text-slate-400 mb-4">Ce QR ne correspond à aucun client.</p>
      <button onClick={onClose} className="rounded-xl bg-slate-100 px-5 py-2 text-sm font-medium text-slate-600">Fermer</button>
    </div>
  );

  if (selectedCCId) return <TransactionModal customerCardId={selectedCCId} onClose={onClose} onScanNext={onScanNext} />;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <p className="font-bold text-slate-900">{customer.name}</p>
        <p className="text-sm text-slate-400">Choisissez la carte à créditer</p>
      </div>
      <div className="px-4 py-3 space-y-2">
        {cards.map((cc) => {
          const card = loyaltyCards.find((c) => c.id === cc.cardId);
          if (!card) return null;
          return (
            <button key={cc.id} onClick={() => setSelectedCCId(cc.id)}
              className="w-full flex items-center gap-3 rounded-xl border border-slate-200 p-3 hover:border-green-300 hover:bg-green-50 transition-colors">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: card.backgroundColor, color: card.accentColor }}>
                {card.name.charAt(0).toUpperCase()}
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-800">{card.name}</p>
                <p className="text-xs text-slate-400">
                  {card.loyaltyMode === "stamps" ? `${cc.stamps}/${card.stampsRequired} tampons` : `${cc.points.toLocaleString("fr-FR")} pts`}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      <div className="px-5 py-3 border-t border-slate-100">
        <button onClick={onClose} className="w-full text-xs text-slate-400 hover:text-slate-600">Annuler</button>
      </div>
    </div>
  );
}

// ── Wallet camera scanner ─────────────────────────────────────────────────────

function WalletCamera({ onDetected, onClose }: { onDetected: (raw: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const detectedRef = useRef(false);
  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting");
  const [errorMsg, setErrorMsg] = useState("");
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn((v) => !v);
    } catch { /* torche non disponible */ }
  }, [torchOn]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (videoRef.current) videoRef.current.srcObject = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const handleDetected = useCallback((raw: string) => {
    if (detectedRef.current) return;
    detectedRef.current = true;
    vibrate(60);
    stopCamera();
    onDetected(raw);
  }, [stopCamera, onDetected]);

  const scanFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) { rafRef.current = requestAnimationFrame(scanFrame); return; }
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    try {
      // @ts-expect-error BarcodeDetector is Chromium-only
      if (typeof BarcodeDetector !== "undefined") {
        // @ts-expect-error BarcodeDetector is Chromium-only
        const detector = new BarcodeDetector({ formats: ["qr_code"] });
        const results = await detector.detect(canvas);
        if (results.length > 0) { handleDetected(results[0].rawValue as string); return; }
      } else {
        const { default: jsQR } = await import("jsqr");
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height);
        if (code) { handleDetected(code.data); return; }
      }
    } catch { /* ignore */ }
    rafRef.current = requestAnimationFrame(scanFrame);
  }, [handleDetected]);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
          setStatus("scanning");
          rafRef.current = requestAnimationFrame(scanFrame);
        }
        // Lampe torche si la caméra la propose (utile en boutique sombre)
        try {
          const caps = stream.getVideoTracks()[0]?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
          if (caps?.torch) setTorchAvailable(true);
        } catch { /* pas de torche */ }
      })
      .catch((e) => { setStatus("error"); setErrorMsg(e.message ?? "Caméra inaccessible"); });
    return () => stopCamera();
  }, [scanFrame, stopCamera]);

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 bg-black">
      <div className="relative aspect-square">
        <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative h-44 w-44">
            <div className="absolute inset-0 rounded-2xl ring-2 ring-white/30" />
            {[["top-0 left-0", "border-t-2 border-l-2"], ["top-0 right-0", "border-t-2 border-r-2"],
              ["bottom-0 left-0", "border-b-2 border-l-2"], ["bottom-0 right-0", "border-b-2 border-r-2"]].map(([pos, border], i) => (
              <div key={i} className={`absolute h-5 w-5 ${pos} ${border} border-white`} />
            ))}
          </div>
        </div>
        <button onClick={() => { stopCamera(); onClose(); }}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70">
          <X className="h-4 w-4" />
        </button>
        {torchAvailable && (
          <button onClick={toggleTorch}
            className={`absolute bottom-3 left-3 flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
              torchOn ? "bg-amber-400 text-slate-900" : "bg-black/50 text-white hover:bg-black/70"
            }`}>
            {torchOn ? <ZapOff className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
          </button>
        )}
      </div>
      <div className="px-4 py-3 text-center">
        {status === "starting" && <p className="text-white/60 text-xs">Démarrage de la caméra…</p>}
        {status === "scanning" && <p className="text-white/80 text-xs">Pointez vers la carte wallet du client</p>}
        {status === "error" && <p className="text-red-400 text-xs">{errorMsg || "Caméra inaccessible"}</p>}
      </div>
    </div>
  );
}

// ── Section 1 : Créditer un client ───────────────────────────────────────────

function CreditTab() {
  const [mode, setMode] = useState<"idle" | "camera" | "transaction" | "search">("idle");
  const [detectedCCId, setDetectedCCId] = useState<string | null>(null);
  const [detectedClientId, setDetectedClientId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<{ cust: Cust; cc: CustCard; cardMode: string } | null>(null);
  const [actionResult, setActionResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [acting, setActing] = useState(false);
  const [customPoints, setCustomPoints] = useState("10");

  const handleWalletDetected = (raw: string) => {
    let path = raw;
    try { path = new URL(raw).pathname; } catch { /* raw is already a path or id */ }
    const processMatch = path.match(/^\/process\/(.+)$/);
    if (processMatch) { setDetectedCCId(processMatch[1]); setMode("transaction"); return; }
    if (!raw.includes("/") && !raw.includes(":")) {
      // ID brut : les cartes client commencent par "cc", les clients par "c"
      if (raw.startsWith("cc")) setDetectedCCId(raw);
      else setDetectedClientId(raw);
      setMode("transaction");
      return;
    }
    setMode("idle");
  };

  const reset = () => { setMode("idle"); setDetectedCCId(null); setDetectedClientId(null); };
  // Après un crédit : on enchaîne directement sur le scan du client suivant
  const scanNext = () => { setDetectedCCId(null); setDetectedClientId(null); setMode("camera"); };

  const search = async (q: string) => {
    setQuery(q); setSelected(null); setActionResult(null);
    if (q.trim().length < 2) { setResults(null); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/register?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setResults(data);
    } catch { /**/ }
    setSearching(false);
  };

  const doAction = async (action: "stamp" | "points", pts?: number) => {
    if (!selected) return;
    setActing(true); setActionResult(null);
    try {
      const res = await fetch("/api/register", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, customerCardId: selected.cc.id, points: pts }),
      });
      if (res.ok) {
        vibrate([30, 40, 30]);
        setActionResult({ ok: true, msg: action === "stamp" ? "+1 tampon ajouté !" : `+${pts} points ajoutés !` });
        await search(query);
      } else {
        const d = await res.json();
        setActionResult({ ok: false, msg: d.error ?? "Erreur" });
      }
    } catch { setActionResult({ ok: false, msg: "Erreur réseau." }); }
    setActing(false);
  };

  const loyaltyCards = results?.loyaltyCards ?? [];

  return (
    <div className="space-y-5">
      {/* Scanner carte wallet */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Scanner carte wallet</p>
        {mode === "camera" ? (
          <WalletCamera
            onDetected={handleWalletDetected}
            onClose={() => setMode("idle")}
          />
        ) : mode === "transaction" ? (
          <div>
            {detectedCCId && <TransactionModal customerCardId={detectedCCId} onClose={reset} onScanNext={scanNext} />}
            {detectedClientId && <ClientIdTransactionModal clientId={detectedClientId} onClose={reset} onScanNext={scanNext} />}
          </div>
        ) : (
          <button onClick={() => setMode("camera")}
            className="w-full h-14 flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 text-[15px] font-bold text-white shadow-lg shadow-green-600/25 hover:from-green-700 hover:to-emerald-700 active:scale-[0.99] transition-all">
            <Camera className="h-5 w-5" />
            Scanner la carte du client
          </button>
        )}
      </div>

      {/* Séparateur */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-[11px] font-medium text-slate-400">ou chercher manuellement</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* Recherche manuelle */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text" value={query} onChange={(e) => search(e.target.value)}
            enterKeyHint="search"
            placeholder="Nom, email ou téléphone…"
            className="w-full h-11 rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400"
          />
          {searching && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />}
        </div>

        {results && !selected && (
          <div className="space-y-1.5">
            {results.customers.length === 0 ? (
              <p className="text-[13px] text-slate-400 text-center py-3">Aucun client trouvé</p>
            ) : (
              results.customers.map((c) => {
                const ccs = results.customerCards.filter((cc) => cc.customerId === c.id);
                return (
                  <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[13px] font-semibold text-slate-900">{c.name}</p>
                    {c.email && <p className="text-[11px] text-slate-400">{c.email}</p>}
                    {ccs.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {ccs.map((cc) => {
                          const lc = loyaltyCards.find((l) => l.id === cc.cardId);
                          const cardMode = lc?.loyaltyMode ?? (cc.stamps > 0 ? "stamps" : "points");
                          return (
                            <button key={cc.id} onClick={() => { setSelected({ cust: c, cc, cardMode }); setActionResult(null); }}
                              className="w-full flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 hover:bg-slate-100 transition-colors">
                              <span className="text-[12px] text-slate-600">
                                {cardMode === "stamps"
                                  ? <><Stamp className="inline h-3 w-3 mr-1 text-green-500" />{cc.stamps} tampon{cc.stamps > 1 ? "s" : ""}</>
                                  : <><Star className="inline h-3 w-3 mr-1 text-amber-500" />{cc.points} pts</>}
                              </span>
                              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {selected && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[14px] font-semibold text-slate-900">{selected.cust.name}</p>
                <p className="text-[12px] text-slate-400">
                  {selected.cardMode === "stamps"
                    ? `${selected.cc.stamps} tampon${selected.cc.stamps > 1 ? "s" : ""}`
                    : `${selected.cc.points} points`}
                </p>
              </div>
              <button onClick={() => { setSelected(null); setActionResult(null); }} className="text-slate-400 hover:text-slate-700 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {selected.cardMode === "stamps" ? (
              <button onClick={() => doAction("stamp")} disabled={acting}
                className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-green-600 text-[13px] font-semibold text-white hover:bg-green-700 disabled:opacity-40 transition-colors">
                {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} +1 Tampon
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  type="number" min="1" inputMode="numeric" value={customPoints} onChange={(e) => setCustomPoints(e.target.value)}
                  className="w-20 h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                />
                <button onClick={() => doAction("points", parseInt(customPoints) || 10)}
                  disabled={acting || !customPoints || parseInt(customPoints) < 1}
                  className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-violet-600 text-[13px] font-semibold text-white hover:bg-violet-700 disabled:opacity-40 transition-colors">
                  {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
                  Ajouter points
                </button>
              </div>
            )}

            {actionResult && (
              <div className={`rounded-xl px-3 py-2 text-[12px] font-medium flex items-center gap-2 ${actionResult.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {actionResult.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                {actionResult.msg}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section 2 : Valider une récompense ───────────────────────────────────────

function RewardTab() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanRewardResult | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  useEffect(() => () => { stopCamera(); }, [stopCamera]);

  const startCamera = async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      // La vidéo est toujours dans le DOM (juste cachée) → ref toujours disponible
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
      scanLoop(stream);
    } catch { setCameraError("Impossible d'accéder à la caméra."); }
  };

  const scanLoop = async (stream: MediaStream) => {
    if (!("BarcodeDetector" in window)) {
      const jsQR = (await import("jsqr")).default;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const video = videoRef.current!;
      const loop = () => {
        if (!stream.active) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth; canvas.height = video.videoHeight;
          ctx?.drawImage(video, 0, 0);
          const img = ctx?.getImageData(0, 0, canvas.width, canvas.height);
          if (img) { const code = jsQR(img.data, img.width, img.height); if (code?.data) { stopCamera(); handleScan(code.data); return; } }
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop); return;
    }
    const detector = new (window as Window & { BarcodeDetector: new (o: object) => { detect(v: HTMLVideoElement): Promise<Array<{ rawValue: string }>> } }).BarcodeDetector({ formats: ["qr_code"] });
    const video = videoRef.current!;
    const loop = async () => {
      if (!stream.active) return;
      try { const c = await detector.detect(video); if (c.length) { stopCamera(); handleScan(c[0].rawValue); return; } } catch { /**/ }
      setTimeout(loop, 150);
    };
    setTimeout(loop, 500);
  };

  const handleScan = async (t: string) => { vibrate(60); setToken(t); await validate(t); };

  const validate = async (t: string) => {
    const tok = t.trim(); if (!tok) return;
    setLoading(true); setResult(null);
    try {
      const res = await fetch("/api/client/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: tok }) });
      const data = await res.json();
      setResult(res.ok ? { ok: true, ...data } : { ok: false, error: data.error ?? "Erreur" });
    } catch { setResult({ ok: false, error: "Erreur réseau." }); }
    setLoading(false);
  };

  const reset = () => { setToken(""); setResult(null); stopCamera(); setTimeout(() => inputRef.current?.focus(), 50); };
  // Relance directement la caméra (sans ouvrir le clavier) pour le scan suivant
  const scanAgain = () => { setToken(""); setResult(null); startCamera(); };

  return (
    <div className="space-y-4">
      {/* Vidéo toujours dans le DOM pour que videoRef soit disponible avant setCameraActive(true) */}
      <div className={`relative rounded-2xl overflow-hidden bg-black aspect-square max-h-64 ${cameraActive ? "" : "hidden"}`}>
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-40 h-40 border-2 border-white/60 rounded-2xl" />
        </div>
        <button onClick={stopCamera} className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/50 flex items-center justify-center text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      {!cameraActive && (
        <button onClick={startCamera}
          className="w-full h-14 flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 text-[15px] font-bold text-white shadow-lg shadow-green-600/25 hover:from-green-700 hover:to-emerald-700 active:scale-[0.99] transition-all">
          <Camera className="h-5 w-5" /> Scanner le QR de récompense
        </button>
      )}
      {cameraError && <p className="text-[12px] text-red-500">{cameraError}</p>}

      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 mb-2">Ou saisir le code manuellement</p>
        <div className="flex gap-2">
          <input ref={inputRef} type="text" value={token}
            onChange={(e) => { setToken(e.target.value); setResult(null); }}
            onKeyDown={(e) => e.key === "Enter" && validate(token)}
            enterKeyHint="go"
            placeholder="Code UUID du QR…"
            className="flex-1 h-11 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 font-mono"
          />
          <button onClick={() => validate(token)} disabled={loading || !token.trim()}
            className="h-11 px-4 rounded-xl bg-green-600 text-white text-[13px] font-semibold hover:bg-green-700 disabled:opacity-40 transition-colors flex items-center gap-1.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />} Valider
          </button>
        </div>
      </div>

      {result && (
        <div className={`rounded-2xl p-4 border ${result.ok ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
          {result.ok ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span className="text-[14px] font-semibold text-emerald-800">Récompense validée !</span>
              </div>
              <div className="pl-7 space-y-0.5 text-[12px]">
                <p className="text-slate-600">Client : <strong className="text-slate-900">{result.customerName}</strong></p>
                <p className="text-slate-600">Récompense : {result.rewardEmoji} <strong className="text-slate-900">{result.rewardName}</strong></p>
                <p className="text-slate-600">Déduit : <strong className="text-slate-900">-{result.cost} {result.costType === "stamps" ? "tampon(s)" : "points"}</strong></p>
              </div>
              <button onClick={scanAgain}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-[13px] font-bold text-white shadow-sm active:scale-[0.99]">
                <Camera className="h-4 w-4" /> Scanner un autre
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <p className="text-[13px] font-semibold text-red-800">QR invalide</p>
                <p className="text-[12px] text-slate-500 mt-0.5">{result.error}</p>
                <button onClick={reset} className="mt-1 text-[12px] text-slate-500 hover:text-slate-700 transition-colors">Réessayer →</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function ScanPage() {
  const [tab, setTab] = useState<"credit" | "reward">("credit");

  return (
    <div className="max-w-sm mx-auto space-y-6">
      <div>
        <h1 className="text-[20px] font-bold text-slate-900">Scanner</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">Gérez les tampons, points et récompenses</p>
      </div>

      <div className="flex rounded-xl bg-slate-100 p-1 gap-1">
        {([["credit", "Créditer un client"], ["reward", "Valider récompense"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 h-11 rounded-lg text-[13px] font-semibold transition-all ${
              tab === key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "credit" ? <CreditTab /> : <RewardTab />}
    </div>
  );
}
