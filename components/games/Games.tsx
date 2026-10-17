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
      <div className="absolute left-1/2 top-[-6px] z-10 h-0 w-0 -translate-x-1/2
        border-l-[11px] border-r-[11px] border-t-[20px] border-l-transparent border-r-transparent border-t-slate-900" />
      <svg viewBox="0 0 200 200" className="h-full w-full drop-shadow-xl"
        style={{ transform: `rotate(${angle}deg)`, transition: "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)" }}>
        {segments.map((s, i) => {
          const a0 = (i * pas - 90) * (Math.PI / 180);
          const a1 = ((i + 1) * pas - 90) * (Math.PI / 180);
          const grand = pas > 180 ? 1 : 0;
          const d = `M100,100 L${100 + 98 * Math.cos(a0)},${100 + 98 * Math.sin(a0)} A98,98 0 ${grand},1 ${100 + 98 * Math.cos(a1)},${100 + 98 * Math.sin(a1)} Z`;
          const am = ((i + 0.5) * pas - 90) * (Math.PI / 180);
          return (
            <g key={i}>
              <path d={d} fill={COULEURS[i % COULEURS.length]} stroke="#fff" strokeWidth="1.5" />
              <text x={100 + 62 * Math.cos(am)} y={100 + 62 * Math.sin(am)}
                textAnchor="middle" dominantBaseline="middle" fontSize="15"
                transform={`rotate(${(i + 0.5) * pas} ${100 + 62 * Math.cos(am)} ${100 + 62 * Math.sin(am)})`}>
                {s.emoji}
              </text>
            </g>
          );
        })}
        <circle cx="100" cy="100" r="15" fill="#fff" stroke="#e2e8f0" strokeWidth="2" />
      </svg>
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

    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#94a3b8"); g.addColorStop(0.5, "#cbd5e1"); g.addColorStop(1, "#94a3b8");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "600 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Grattez avec le doigt", w / 2, h / 2);

    const point = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(e.clientX - r.left, e.clientY - r.top, 22, 0, Math.PI * 2);
      ctx.fill();
    };

    // Le pourcentage gratté est mesuré sur un échantillon d'un pixel sur
    // seize : relire tout le canvas à chaque mouvement saccadait sur mobile.
    const pourcentage = () => {
      const d = ctx.getImageData(0, 0, w, h).data;
      let vides = 0, total = 0;
      for (let i = 3; i < d.length; i += 4 * 16) { total++; if (d[i] === 0) vides++; }
      return total ? vides / total : 0;
    };

    const down = (e: PointerEvent) => { dessine.current = true; point(e); };
    const move = (e: PointerEvent) => {
      if (!dessine.current) return;
      e.preventDefault();
      point(e);
      if (pourcentage() > 0.6) reveler();
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
      <div className="flex aspect-[5/3] items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100">
        {children}
      </div>
      <canvas ref={ref}
        className={`absolute inset-0 h-full w-full touch-none rounded-2xl transition-opacity duration-500 ${revele ? "pointer-events-none opacity-0" : "cursor-grab"}`} />
      {!revele && (
        <button onClick={reveler}
          className="mt-3 w-full rounded-xl bg-slate-100 py-2.5 text-[13px] font-medium text-slate-600">
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
    setTimeout(() => setOuverts(true), 700);
    setTimeout(onDone, 1700);
  };

  return (
    <div className="grid w-full max-w-[340px] grid-cols-3 gap-3">
      {[0, 1, 2].map((i) => {
        const estChoisi = choisi === i;
        const contenu = estChoisi ? outcome : garnis[i < (choisi ?? 3) ? 0 : 1];
        const ouvert = estChoisi ? choisi !== null : ouverts;
        return (
          <button key={i} onClick={() => choisir(i)} disabled={choisi !== null}
            className={`flex aspect-[3/4] flex-col items-center justify-center rounded-2xl border-2 transition-all duration-500 ${
              estChoisi ? "scale-105 border-green-500 bg-green-50 shadow-lg"
              : choisi !== null ? "border-slate-200 bg-slate-50 opacity-60"
              : "border-slate-200 bg-white hover:-translate-y-1 hover:border-green-400 hover:shadow-md"
            }`}>
            <span className={`text-[34px] transition-transform duration-500 ${estChoisi ? "scale-110" : ""}`}>
              {ouvert && contenu ? (contenu.emoji || "🎁") : "🎁"}
            </span>
            {ouvert && contenu && (
              <span className="mt-1 px-1 text-center text-[10.5px] font-medium leading-tight text-slate-600">
                {contenu.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
