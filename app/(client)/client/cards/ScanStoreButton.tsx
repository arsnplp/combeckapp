"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, X, Zap, ZapOff, Loader2, QrCode } from "lucide-react";

function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* non supporté */ }
}

/**
 * N'accepte QUE les QR d'inscription ComeBack, et uniquement sur notre propre
 * origine : un QR est une donnée non fiable (n'importe qui peut en imprimer un),
 * donc on ne redirige jamais vers une URL arbitraire — sinon le QR d'un tiers
 * pourrait emmener le client sur une page de phishing depuis notre app.
 * Retourne le chemin interne à ouvrir, ou une raison de refus.
 */
export function resolveJoinTarget(raw: string, origin: string):
  | { ok: true; path: string }
  | { ok: false; reason: "own-card" | "foreign" | "unknown" } {
  let url: URL;
  try {
    // Un QR peut contenir une URL absolue ou un chemin relatif
    url = new URL(raw, origin);
  } catch {
    return { ok: false, reason: "unknown" };
  }
  if (url.origin !== origin) return { ok: false, reason: "foreign" };
  // Carte wallet du client lui-même (destinée au commerçant) — erreur fréquente
  if (/^\/process\/[^/]+$/.test(url.pathname)) return { ok: false, reason: "own-card" };
  if (!/^\/join\/[^/]+$/.test(url.pathname)) return { ok: false, reason: "unknown" };
  // Conserve la query (?d=… porte le design de la carte, ?ref=… le parrainage)
  return { ok: true, path: url.pathname + url.search };
}

export default function ScanStoreButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 bg-white py-3.5 text-[13.5px] font-semibold text-gray-600 transition-colors hover:border-gray-400 hover:bg-gray-50 active:scale-[0.99]"
      >
        <QrCode className="h-4 w-4" />
        Ajouter un commerce
      </button>
      {open && <ScanStoreModal onClose={() => setOpen(false)} />}
    </>
  );
}

function ScanStoreModal({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const detectedRef = useRef(false);
  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting");
  const [errorMsg, setErrorMsg] = useState("");
  const [rejected, setRejected] = useState("");
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (videoRef.current) videoRef.current.srcObject = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn((v) => !v);
    } catch { /* torche non disponible */ }
  }, [torchOn]);

  const handleDetected = useCallback((raw: string) => {
    if (detectedRef.current) return;
    const target = resolveJoinTarget(raw, window.location.origin);
    if (!target.ok) {
      // QR non valide : on NE bloque PAS le scan, on affiche l'erreur et on
      // continue à chercher — sinon il faut rouvrir la caméra à chaque erreur.
      setRejected(
        target.reason === "own-card"
          ? "Ceci est votre carte à montrer en caisse. Scannez plutôt l'affiche du commerce."
          : target.reason === "foreign"
            ? "Ce QR code ne vient pas de ComeBack."
            : "QR code non reconnu. Scannez l'affiche d'inscription du commerce.",
      );
      return;
    }
    detectedRef.current = true;
    vibrate(60);
    stopCamera();
    // Navigation pleine page : /join gère déjà l'ajout en un tap quand la
    // session client est active.
    window.location.href = target.path;
  }, [stopCamera]);

  const scanFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) { rafRef.current = requestAnimationFrame(scanFrame); return; }
    const vw = video.videoWidth, vh = video.videoHeight;
    canvas.width = vw; canvas.height = vh;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    try {
      // @ts-expect-error BarcodeDetector is Chromium-only
      if (typeof BarcodeDetector !== "undefined") {
        // @ts-expect-error BarcodeDetector is Chromium-only
        const detector = new BarcodeDetector({ formats: ["qr_code"] });
        const results = await detector.detect(canvas);
        if (results.length > 0) { handleDetected(results[0].rawValue as string); }
      } else {
        const { default: jsQR } = await import("jsqr");
        // Passe 1 : image entière (le QR peut être n'importe où dans le cadre)
        const full = ctx.getImageData(0, 0, vw, vh);
        let code = jsQR(full.data, vw, vh, { inversionAttempts: "dontInvert" });
        if (!code) {
          // Passe 2 : carré central, là où le viseur invite à placer le code.
          // Sur un QR dense, ce recadrage double le nombre de pixels par
          // module et fait passer des images que la passe 1 rate.
          const side = Math.floor(Math.min(vw, vh) * 0.8);
          const sx = Math.floor((vw - side) / 2), sy = Math.floor((vh - side) / 2);
          const crop = ctx.getImageData(sx, sy, side, side);
          code = jsQR(crop.data, side, side, { inversionAttempts: "dontInvert" });
        }
        if (code) { handleDetected(code.data); }
      }
    } catch { /* ignore */ }
    if (!detectedRef.current) rafRef.current = requestAnimationFrame(scanFrame);
  }, [handleDetected]);

  useEffect(() => {
    // L'API caméra n'existe pas partout : navigateur intégré (Instagram,
    // Messenger…), app ajoutée à l'écran d'accueil sur certains iPhone, ou
    // page servie sans HTTPS. Sans ce test, l'appel se dissolvait
    // silencieusement et l'écran restait noir sans la moindre explication.
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setErrorMsg("unsupported");
      return;
    }
    let cancelled = false;
    try {
      navigator.mediaDevices.getUserMedia({
        // Le QR d'inscription est dense (~85x85 modules car il embarque le
        // design de la carte). En résolution par défaut (souvent 640x480) il
        // reste ~2 pixels par module : trop peu pour être décodé. On demande
        // donc explicitement du 1080p, avec repli automatique si l'appareil
        // ne sait pas faire.
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
        .then((stream) => {
          if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
            setStatus("scanning");
            rafRef.current = requestAnimationFrame(scanFrame);
          }
          try {
            const caps = stream.getVideoTracks()[0]?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
            if (caps?.torch) setTorchAvailable(true);
          } catch { /* pas de torche */ }
        })
        .catch((e) => {
          if (cancelled) return;
          setStatus("error");
          setErrorMsg(e?.name === "NotAllowedError" || e?.name === "NotFoundError" ? "denied" : "unsupported");
        });
    } catch {
      setStatus("error");
      setErrorMsg("unsupported");
    }
    return () => { cancelled = true; stopCamera(); };
  }, [scanFrame, stopCamera]);

  const close = () => { stopCamera(); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={close}>
      <div className="w-full max-w-sm overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-[15px] font-bold text-gray-900">Ajouter un commerce</p>
            <p className="text-[12.5px] text-gray-500">Scannez le QR code affiché en boutique</p>
          </div>
          <button onClick={close} aria-label="Fermer"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        {status === "error" ? (
          // Pas de carré noir inerte : on explique pourquoi et surtout comment
          // s'en sortir — l'appareil photo natif du téléphone ouvre le lien du
          // QR directement, sans passer par cette page.
          <div className="px-5 pb-5">
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-[13px] font-semibold text-amber-800">
                {errorMsg === "denied"
                  ? "Accès à la caméra refusé"
                  : "La caméra n'est pas accessible ici"}
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-amber-700">
                {errorMsg === "denied"
                  ? "Autorisez la caméra pour ce site dans les réglages de votre navigateur, puis réessayez."
                  : "Certains navigateurs (Instagram, Messenger…) et l'app ajoutée à l'écran d'accueil ne permettent pas d'ouvrir la caméra."}
              </p>
              <div className="mt-3 rounded-xl bg-white/70 p-3">
                <p className="text-[12.5px] font-semibold text-slate-800">💡 Le plus simple</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">
                  Ouvrez l&apos;<strong>appareil photo</strong> de votre téléphone et visez le QR code du
                  commerce : la carte s&apos;ajoutera automatiquement à votre compte.
                </p>
              </div>
            </div>
            <button onClick={close}
              className="mt-3 w-full rounded-2xl border border-gray-200 py-3 text-[13px] font-semibold text-gray-600 hover:bg-gray-50">
              Fermer
            </button>
          </div>
        ) : (
          <>
        <div className="relative aspect-square bg-black">
          <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted />
          <canvas ref={canvasRef} className="hidden" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-44 w-44">
              <div className="absolute inset-0 rounded-2xl ring-2 ring-white/30" />
              {[["top-0 left-0", "border-t-2 border-l-2"], ["top-0 right-0", "border-t-2 border-r-2"],
                ["bottom-0 left-0", "border-b-2 border-l-2"], ["bottom-0 right-0", "border-b-2 border-r-2"]].map(([pos, border], i) => (
                <div key={i} className={`absolute h-5 w-5 ${pos} ${border} border-white`} />
              ))}
            </div>
          </div>
          {status === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-white/70" />
            </div>
          )}
          {torchAvailable && status === "scanning" && (
            <button onClick={toggleTorch} aria-label="Lampe"
              className={`absolute bottom-3 left-3 flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
                torchOn ? "bg-amber-400 text-slate-900" : "bg-black/50 text-white hover:bg-black/70"
              }`}>
              {torchOn ? <ZapOff className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
            </button>
          )}
        </div>

        <div className="px-5 py-4 text-center">
          {rejected ? (
            <p className="text-[12.5px] font-medium text-amber-600">{rejected}</p>
          ) : (
            <p className="flex items-center justify-center gap-1.5 text-[12.5px] text-gray-500">
              <Camera className="h-3.5 w-3.5" /> Pointez vers le QR code du commerce
            </p>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
}
