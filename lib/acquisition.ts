import { createHash } from "crypto";
import { supabase } from "./supabase";

/**
 * Suivi d'acquisition maison, sans cookie ni outil tiers.
 *
 * Les landings (foodtruck / caviste) envoient trois évènements à
 * /api/track ; l'inscription mémorise la landing et les UTM d'origine.
 * L'admin en tire un entonnoir : visites → clics → comptes → essais.
 *
 * Tout ce module est tolérant : si la migration
 * supabase/migrations/acquisition-tracking.sql n'a pas encore été lancée,
 * rien ne plante, les écritures sont simplement ignorées.
 */

export const ACQ_SITES = ["foodtruck", "caviste", "site"] as const;
export type AcqSite = (typeof ACQ_SITES)[number];

export const ACQ_EVENTS = ["pageview", "cta_click", "scroll_75"] as const;
export type AcqEvent = (typeof ACQ_EVENTS)[number];

export const ACQ_SITE_LABELS: Record<AcqSite, string> = {
  foodtruck: "Landing food truck",
  caviste: "Landing cavistes",
  site: "Site getcomeback.fr",
};

/** Origines autorisées à appeler /api/track depuis un navigateur. */
export const ACQ_ALLOWED_ORIGINS = new Set([
  "https://foodtruck.getcomeback.fr",
  "https://caviste.getcomeback.fr",
  "https://getcomeback.fr",
  "https://www.getcomeback.fr",
]);

export function isAcqSite(v: unknown): v is AcqSite {
  return typeof v === "string" && (ACQ_SITES as readonly string[]).includes(v);
}

export function isAcqEvent(v: unknown): v is AcqEvent {
  return typeof v === "string" && (ACQ_EVENTS as readonly string[]).includes(v);
}

/** Texte court et propre, ou null. Jamais plus de `max` caractères. */
export function cleanText(v: unknown, max = 80): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
  return s || null;
}

/**
 * Empreinte anonyme d'un visiteur, valable une journée.
 *
 * Même principe que les outils de mesure sans cookie : on hache l'IP et le
 * navigateur avec un sel qui change chaque jour. Deux pages vues le même
 * jour comptent pour un visiteur ; le lendemain l'empreinte est différente,
 * et il est impossible de remonter à l'IP. Rien n'est stocké côté visiteur.
 */
export function visitorHash(ip: string, userAgent: string, now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "comeback";
  return createHash("sha256").update(`${day}|${secret}|${ip}|${userAgent}`).digest("hex").slice(0, 20);
}

const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|node-fetch|axios/i;

export function isBot(userAgent: string): boolean {
  return !userAgent || BOT_RE.test(userAgent);
}

export function deviceOf(userAgent: string): "mobile" | "desktop" {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent) ? "mobile" : "desktop";
}

/** Nom de domaine d'un referrer, sans chemin ni paramètres. */
export function referrerHost(v: unknown): string | null {
  const s = cleanText(v, 300);
  if (!s) return null;
  try {
    return new URL(s).hostname.slice(0, 80) || null;
  } catch {
    return null;
  }
}

export interface AcqEventInput {
  site: AcqSite;
  event: AcqEvent;
  visitor: string;
  position?: string | null;
  etape?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  referrer?: string | null;
  device?: string | null;
}

/** Enregistre un évènement. Ne lève jamais : la mesure ne doit rien casser. */
export async function recordAcqEvent(e: AcqEventInput): Promise<void> {
  try {
    await supabase().from("lp_events").insert({
      site: e.site,
      event: e.event,
      visitor: e.visitor,
      position: e.position ?? null,
      etape: e.etape ?? null,
      utm_source: e.utmSource ?? null,
      utm_medium: e.utmMedium ?? null,
      utm_campaign: e.utmCampaign ?? null,
      utm_content: e.utmContent ?? null,
      referrer: e.referrer ?? null,
      device: e.device ?? null,
    });
  } catch {
    /* table absente ou base indisponible : on ignore */
  }
}

/**
 * Source d'une inscription, telle qu'envoyée par la page /signup
 * (paramètres `lp` et `utm_*` de l'URL). Tout est optionnel.
 */
export interface SignupSource {
  site: AcqSite | null;
  utmSource: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
}

export function parseSignupSource(raw: unknown): SignupSource | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const source: SignupSource = {
    site: isAcqSite(r.lp) ? r.lp : null,
    utmSource: cleanText(r.utm_source),
    utmCampaign: cleanText(r.utm_campaign, 120),
    utmContent: cleanText(r.utm_content, 120),
  };
  return source.site || source.utmSource || source.utmCampaign || source.utmContent ? source : null;
}

/**
 * Mémorise la source sur le commerçant, dans une écriture séparée de la
 * création du compte : si les colonnes n'existent pas encore, seule cette
 * écriture échoue (en silence) et l'inscription aboutit quand même.
 */
export async function saveSignupSource(merchantId: string, raw: unknown): Promise<void> {
  const source = parseSignupSource(raw);
  if (!source) return;
  try {
    await supabase().from("merchants").update({
      acq_site: source.site,
      acq_utm_source: source.utmSource,
      acq_utm_campaign: source.utmCampaign,
      acq_utm_content: source.utmContent,
    }).eq("id", merchantId);
  } catch {
    /* colonnes absentes : on ignore */
  }
}

// ── Entonnoir (admin) ────────────────────────────────────────────────────────

export interface FunnelRow {
  /** Clé de la source : une landing, ou "other" pour tout le reste. */
  key: AcqSite | "other";
  label: string;
  visitors: number;
  scrolled: number;
  clicked: number;
  signups: number;
  trials: number;
}

export interface FunnelResult {
  /** false tant que la migration n'a pas été lancée. */
  ready: boolean;
  days: number;
  rows: FunnelRow[];
}

export const FUNNEL_PERIODS = [7, 30, 90] as const;

export async function getFunnel(days: number): Promise<FunnelResult> {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const sb = supabase();

  const [events, merchants] = await Promise.all([
    sb.rpc("lp_funnel", { since }),
    sb.from("merchants").select("acq_site, trial_used_at, is_admin").gte("created_at", since),
  ]);
  if (events.error || merchants.error) return { ready: false, days, rows: [] };

  const empty = (key: FunnelRow["key"], label: string): FunnelRow =>
    ({ key, label, visitors: 0, scrolled: 0, clicked: 0, signups: 0, trials: 0 });
  const rows = new Map<FunnelRow["key"], FunnelRow>(
    ACQ_SITES.map((s) => [s, empty(s, ACQ_SITE_LABELS[s])]),
  );
  rows.set("other", empty("other", "Autre (direct, cold call, bouche à oreille)"));

  for (const e of (events.data ?? []) as Array<{ site: string; event: string; visitors: number }>) {
    if (!isAcqSite(e.site)) continue;
    const row = rows.get(e.site)!;
    const n = Number(e.visitors) || 0;
    if (e.event === "pageview") row.visitors = n;
    else if (e.event === "scroll_75") row.scrolled = n;
    else if (e.event === "cta_click") row.clicked = n;
  }

  for (const m of (merchants.data ?? []) as Array<{ acq_site: string | null; trial_used_at: string | null; is_admin: boolean | null }>) {
    if (m.is_admin) continue;
    const row = rows.get(isAcqSite(m.acq_site) ? m.acq_site : "other")!;
    row.signups++;
    if (m.trial_used_at) row.trials++;
  }

  // Le site principal n'envoie encore rien : on ne l'affiche que s'il a des chiffres.
  const list = [...rows.values()].filter(
    (r) => r.key !== "site" || r.visitors > 0 || r.signups > 0,
  );
  return { ready: true, days, rows: list };
}
