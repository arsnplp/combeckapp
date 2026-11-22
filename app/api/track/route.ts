import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getIp } from "@/lib/rate-limit";
import {
  ACQ_ALLOWED_ORIGINS, cleanText, deviceOf, isAcqEvent, isAcqSite, isBot,
  recordAcqEvent, referrerHost, visitorHash,
} from "@/lib/acquisition";

/**
 * POST /api/track : évènement de mesure envoyé par une landing.
 *
 * Public et sans session : appelé depuis foodtruck.getcomeback.fr et
 * caviste.getcomeback.fr. Le corps est du JSON envoyé en `text/plain`, ce qui
 * en fait une requête « simple » pour le navigateur (pas de pré-requête CORS).
 *
 * Répond toujours 204, même quand l'évènement est refusé : un appelant ne
 * doit rien apprendre, et une landing ne doit jamais afficher d'erreur à
 * cause de la mesure.
 */

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed =
    ACQ_ALLOWED_ORIGINS.has(origin) ||
    (process.env.NODE_ENV !== "production" && /^http:\/\/localhost(:\d+)?$/.test(origin));
  return allowed
    ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
    : {};
}

const done = (req: NextRequest) => new NextResponse(null, { status: 204, headers: corsHeaders(req) });

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(req),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function POST(req: NextRequest) {
  // Seules nos landings ont le droit d'écrire : sans cet en-tête (ou avec un
  // autre site), on ne stocke rien.
  if (!("Access-Control-Allow-Origin" in corsHeaders(req))) return done(req);

  const userAgent = req.headers.get("user-agent") ?? "";
  if (isBot(userAgent)) return done(req);

  const ip = getIp(req);
  // Une visite normale envoie trois ou quatre évènements. 40 par minute
  // laisse de la marge à un commerce derrière une IP partagée.
  if (!checkRateLimit(`track:${ip}`, 40, 60 * 1000)) return done(req);

  let body: Record<string, unknown>;
  try {
    const text = await req.text();
    if (text.length > 2000) return done(req);
    body = JSON.parse(text);
  } catch {
    return done(req);
  }
  if (!body || typeof body !== "object") return done(req);
  if (!isAcqSite(body.site) || !isAcqEvent(body.event)) return done(req);

  await recordAcqEvent({
    site: body.site,
    event: body.event,
    visitor: visitorHash(ip, userAgent),
    position: cleanText(body.position, 40),
    etape: cleanText(body.etape, 20),
    utmSource: cleanText(body.utm_source),
    utmMedium: cleanText(body.utm_medium),
    utmCampaign: cleanText(body.utm_campaign, 120),
    utmContent: cleanText(body.utm_content, 120),
    referrer: referrerHost(body.referrer),
    device: deviceOf(userAgent),
  });

  return done(req);
}
