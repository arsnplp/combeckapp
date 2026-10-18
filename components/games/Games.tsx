"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Les trois habillages. Aucun ne décide de quoi que ce soit : le serveur a
 * déjà tiré, ils reçoivent le résultat et l'amènent joliment à l'écran.
 */

export interface Segment { rewardId: string | null; label: string; emoji: string; percent: number }

const COULEURS = ["#16a34a", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6", "#ec4899", "#64748b"];

/** Index du segment qui correspond au résultat renvoyé par le serveur. */
function indexGagnant(segments: Segment[], rewardId: string | null): number {
  const i = segments.findIndex((s) => s.rewardId === rewardId);
  return i >= 0 ? i : Math.max(0, segments.findIndex((s) => s.rewardId === null));
}

// ── Confettis ────────────────────────────────────────────────────────────────

export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    c.width = c.offsetWidth; c.height = c.offsetHeight;
    const parts = Array.from({ length: 90 }, () => ({
      x: c.width / 2, y: c.height / 3,
      vx: (Math.random() - 0.5) * 11,
      vy: Math.random() * -12 - 3,
      r: Math.random() * 5 + 2.5,
      col: COULEURS[Math.floor(Math.random() * COULEURS.length)],
      rot: Math.random() * Math.PI,
    }));
    let raf = 0, frames = 0;
    const tick = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      for (const p of parts) {
        p.vy += 0.32; p.x += p.vx; p.y += p.vy; p.rot += 0.12;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.col;
        ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        ctx.restore();
      }
      if (++frames < 150) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 z-20 h-full w-full" />;
}

// ── Roue de la fortune ───────────────────────────────────────────────────────

export function Wheel({ segments, outcome, onDone }: {
  segments: Segment[]; outcome: { rewardId: string | null } | null; onDone: () => void;
}) {
  const [angle, setAngle] = useState(0);
  const lance = useRef(false);

  useEffect(() => {
    if (!outcome || lance.current || segments.length === 0) return;
    lance.current = true;
    const n = segments.length;
    const pas = 360 / n;
    const cible = indexGagnant(segments, outcome.rewardId);
    // Le repère est en haut : on amène le milieu du segment sous l'aiguille,
    // plus cinq tours pour que ça ressemble à une vraie roue lancée.
    const final = 360 * 5 + (360 - (cible * pas + pas / 2));
    requestAnimationFrame(() => setAngle(final));
    const t = setTimeout(onDone, 4300);
    return () => clearTimeout(t);
  }, [outcome, segments, onDone]);

  const n = Math.max(1, segments.length);
  const pas = 360 / n;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[300px]">
      {/* Aiguille : arrondie et ombrée, elle mordait le bord de la roue */}
      <div className="absolute left-1/2 top-[-10px] z-20 -translate-x-1/2 drop-shadow-md">
        <svg width="26" height="30" viewBox="0 0 26 30">
          <path d="M13 29 L2 6 A13 13 0 0 1 24 6 Z" fill="#0f172a" />
          <circle cx="13" cy="8" r="3.5" fill="#fff" />
        </svg>
      </div>

      {/* Jante fixe : la roue tourne à l'intérieur */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 shadow-[0_18px_40px_-12px_rgba(15,23,42,0.5)]" />
      <div className="absolute inset-[7px] rounded-full bg-white/90" />

      <svg viewBox="0 0 200 200" className="absolute inset-[9px] h-[calc(100%-18px)] w-[calc(100%-18px)]"
        style={{ transform: `rotate(${angle}deg)`, transition: "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)" }}>
        <defs>
          <radialGradient id="lustre" cx="35%" cy="25%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
            <stop offset="70%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        {segments.map((s, i) => {
          const a0 = (i * pas - 90) * (Math.PI / 180);
          const a1 = ((i + 1) * pas - 90) * (Math.PI / 180);
          const grand = pas > 180 ? 1 : 0;
          const d = `M100,100 L${100 + 98 * Math.cos(a0)},${100 + 98 * Math.sin(a0)} A98,98 0 ${grand},1 ${100 + 98 * Math.cos(a1)},${100 + 98 * Math.sin(a1)} Z`;
          const am = ((i + 0.5) * pas - 90) * (Math.PI / 180);
          const rotTexte = (i + 0.5) * pas;
          return (
            <g key={i}>
              <path d={d} fill={COULEURS[i % COULEURS.length]} stroke="#ffffff" strokeWidth="2" />
              <g transform={`rotate(${rotTexte} 100 100)`}>
                <text x="100" y="38" textAnchor="middle" fontSize="19">{s.emoji}</text>
                {/* Le pourcentage sous l'emoji : la roue annonce elle-même
                    les chances, sans avoir à déplier la liste en dessous. */}
                <text x="100" y="53" textAnchor="middle" fontSize="9"
                  fill="#ffffff" fillOpacity="0.85" fontWeight="600">
                  {s.percent} %
                </text>
              </g>
            </g>
          );
        })}
        <circle cx="100" cy="100" r="98" fill="url(#lustre)" pointerEvents="none" />
      </svg>

      {/* Moyeu */}
      <div className="absolute left-1/2 top-1/2 z-10 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg ring-4 ring-slate-900">
        <div className="absolute inset-[7px] rounded-full bg-gradient-to-br from-green-500 to-emerald-600" />
      </div>
    </div>
  );
}

// ── Carte à gratter ──────────────────────────────────────────────────────────

export function Scratch({ children, onRevealed }: { children: React.ReactNode; onRevealed: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [revele, setRevele] = useState(false);
  const dessine = useRef(false);

  const reveler = useCallback(() => {
    if (revele) return;
    setRevele(true);
    onRevealed();
  }, [revele, onRevealed]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const w = c.offsetWidth, h = c.offsetHeight;
    c.width = w; c.height = h;

    // Métal brossé plutôt qu'un aplat gris : le dégradé en biais et le
    // grain donnent l'impression d'une vraie carte à gratter.
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#64748b"); g.addColorStop(0.35, "#cbd5e1");
    g.addColorStop(0.5, "#e2e8f0"); g.addColorStop(0.65, "#cbd5e1");
    g.addColorStop(1, "#64748b");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = 0.14;
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? "#fff" : "#475569";
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6);
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(-w * 0.1, h); ctx.lineTo(w * 0.35, 0);
    ctx.lineTo(w * 0.55, 0); ctx.lineTo(w * 0.1, h);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    ctx.fillStyle = "rgba(15,23,42,0.45)";
    ctx.font = "700 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("GRATTEZ ICI", w / 2, h / 2 - 2);
    ctx.font = "500 11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(15,23,42,0.3)";
    ctx.fillText("avec le doigt", w / 2, h / 2 + 15);

    const point = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(e.clientX - r.left, e.clientY - r.top, 22, 0, Math.PI * 2);
      ctx.fill();
    };

    // Mesuré au CENTRE seulement, là où le lot est dessiné. Sur toute la
    // surface, il fallait gratter jusqu'aux coins alors que le résultat
    // était déjà lisible depuis longtemps — on grattait pour rien.
    // Un pixel sur seize : relire tout le canvas à chaque mouvement
    // saccadait sur mobile.
    const cx = Math.floor(w * 0.25), cy = Math.floor(h * 0.25);
    const cw = Math.max(1, Math.floor(w * 0.5)), ch = Math.max(1, Math.floor(h * 0.5));
    const pourcentage = () => {
      const d = ctx.getImageData(cx, cy, cw, ch).data;
      let vides = 0, total = 0;
      for (let i = 3; i < d.length; i += 4 * 8) { total++; if (d[i] === 0) vides++; }
      return total ? vides / total : 0;
    };

    const down = (e: PointerEvent) => { dessine.current = true; point(e); };
    const move = (e: PointerEvent) => {
      if (!dessine.current) return;
      e.preventDefault();
      point(e);
      // Dès que le lot apparaît au centre, inutile d'insister.
      if (pourcentage() > 0.38) reveler();
    };
    const up = () => { dessine.current = false; };

    c.addEventListener("pointerdown", down);
    c.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    return () => {
      c.removeEventListener("pointerdown", down);
      c.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [reveler]);

  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      <div className="flex aspect-[5/3] items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 via-white to-green-50 shadow-inner ring-1 ring-slate-200">
        {children}
      </div>
      <canvas ref={ref}
        className={`absolute inset-0 h-full w-full touch-none rounded-2xl shadow-lg transition-opacity duration-700 ${revele ? "pointer-events-none opacity-0" : "cursor-grab active:cursor-grabbing"}`} />
      {!revele && (
        <button onClick={reveler}
          className="mt-3 w-full rounded-xl bg-slate-100 py-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-200">
          Tout révéler
        </button>
      )}
    </div>
  );
}

// ── Coffres mystère ──────────────────────────────────────────────────────────

export function Chests({ segments, outcome, onDone }: {
  segments: Segment[]; outcome: { rewardId: string | null; label: string; emoji: string } | null; onDone: () => void;
}) {
  const [choisi, setChoisi] = useState<number | null>(null);
  const [ouverts, setOuverts] = useState(false);

  // Les deux autres coffres montrent ce qu'on aurait pu gagner : plus
  // parlant qu'un coffre vide, et ça donne envie de rejouer.
  const autres = segments.filter((s) => s.rewardId !== (outcome?.rewardId ?? null)).slice(0, 2);
  const garnis = [autres[0] ?? segments[0], autres[1] ?? segments[0]];

  const choisir = (i: number) => {
    if (choisi !== null || !outcome) return;
    setChoisi(i);
    setTimeout(() => setOuverts(true), 750);
    setTimeout(onDone, 1800);
  };

  return (
    <div className="w-full max-w-[340px]">
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => {
          const estChoisi = choisi === i;
          const contenu = estChoisi ? outcome : garnis[i < (choisi ?? 3) ? 0 : 1];
          const ouvert = estChoisi ? choisi !== null : ouverts;
          const enAttente = choisi === null;
          return (
            <button
              key={i}
              onClick={() => choisir(i)}
              disabled={!enAttente}
              style={enAttente ? { animationDelay: `${i * 160}ms` } : undefined}
              className={`relative flex aspect-[3/4] flex-col items-center justify-center overflow-hidden rounded-2xl border-2 transition-all duration-500 ${
                estChoisi
                  ? "-translate-y-1 scale-105 border-amber-400 bg-gradient-to-b from-amber-50 to-amber-100 shadow-[0_16px_32px_-10px_rgba(245,158,11,0.55)]"
                  : choisi !== null
                    ? "border-slate-200 bg-slate-50 opacity-45"
                    : "border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-sm hover:-translate-y-1.5 hover:border-amber-300 hover:shadow-lg active:scale-95"
              } ${enAttente ? "animate-[flotte_2.6s_ease-in-out_infinite]" : ""}`}
            >
              {/* Halo doré derrière le coffre choisi */}
              {estChoisi && (
                <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(251,191,36,0.4),transparent_65%)]" />
              )}
              <span className={`relative text-[36px] transition-transform duration-500 ${estChoisi ? "scale-110" : ""}`}>
                {ouvert && contenu ? (contenu.emoji || "🎁") : "🎁"}
              </span>
              {ouvert && contenu ? (
                <span className="relative mt-1.5 px-1.5 text-center text-[10.5px] font-semibold leading-tight text-slate-700">
                  {contenu.label}
                </span>
              ) : (
                <span className="relative mt-1.5 text-[11px] font-medium text-slate-400">
                  {i + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {choisi === null && (
        <p className="mt-4 text-center text-[13px] text-slate-500">
          Choisissez un coffre
        </p>
      )}

      {/* Flottement léger : trois coffres immobiles font vignette, trois
          coffres qui respirent donnent envie d'en toucher un. */}
      <style jsx>{`
        @keyframes flotte {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
