import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import { geocodeAddress } from "@/lib/geocoding";
import { walletNotificationService } from "@/lib/wallet-notification-service";
import { DEFAULT_PROXIMITY_MESSAGE } from "@/lib/geofencing";

/**
 * Notification de proximité — Apple Wallet uniquement.
 *
 * Route séparée de /api/settings à dessein : cette dernière réécrit tout le
 * blob de réglages à chaque sauvegarde automatique. Y greffer un champ
 * supplémentaire aurait fait courir le risque qu'une sauvegarde partielle
 * efface la configuration sans prévenir.
 */

interface GeofencingPayload {
  enabled?: boolean;
  message?: string;
}

async function readConfig(tenantId: string) {
  const { data } = await supabase()
    .from("merchants")
    .select("wallet_config, address, city")
    .eq("id", tenantId)
    .maybeSingle();
  const walletConfig = (data?.wallet_config ?? {}) as Record<string, unknown>;
  return {
    walletConfig,
    geofencing: (walletConfig.geofencing ?? {}) as Record<string, unknown>,
    address: (data?.address as string) ?? "",
    city: (data?.city as string) ?? "",
  };
}

export async function GET() {
  const session = await auth();
  const tenantId = session?.user?.id;
  if (!tenantId || tenantId === "admin") {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { geofencing, address, city } = await readConfig(tenantId);
  return NextResponse.json({
    enabled: Boolean(geofencing.enabled),
    message: (geofencing.message as string) ?? DEFAULT_PROXIMITY_MESSAGE,
    latitude: geofencing.latitude ?? null,
    longitude: geofencing.longitude ?? null,
    label: geofencing.label ?? null,
    address,
    city,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const tenantId = session?.user?.id;
  if (!tenantId || tenantId === "admin") {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  let payload: GeofencingPayload = {};
  try { payload = await req.json(); } catch { /* corps vide */ }

  const { walletConfig, geofencing, address, city } = await readConfig(tenantId);
  const message = (payload.message ?? geofencing.message ?? DEFAULT_PROXIMITY_MESSAGE)
    .toString().slice(0, 120);

  const next: Record<string, unknown> = { ...geofencing, message };

  if (payload.enabled === false) {
    next.enabled = false;
  } else if (payload.enabled === true) {
    if (!address.trim()) {
      return NextResponse.json(
        { error: "Renseignez d'abord l'adresse de votre commerce dans Paramètres." },
        { status: 400 },
      );
    }
    // Géocodage refait seulement si l'adresse a changé : inutile de
    // solliciter l'API à chaque modification du message.
    const cle = `${address}|${city}`;
    if (cle !== geofencing.geocodedFrom || typeof geofencing.latitude !== "number") {
      const point = await geocodeAddress(address, city);
      if (!point) {
        return NextResponse.json(
          { error: "Adresse introuvable. Vérifiez-la dans Paramètres (numéro, rue, code postal)." },
          { status: 422 },
        );
      }
      // En dessous de 0.5, l'API a deviné : mieux vaut le dire que de poser
      // un déclencheur à deux rues de la boutique.
      if (point.score < 0.5) {
        return NextResponse.json(
          { error: `Adresse trop imprécise (« ${point.label} »). Complétez-la dans Paramètres.` },
          { status: 422 },
        );
      }
      next.latitude = point.latitude;
      next.longitude = point.longitude;
      next.label = point.label;
      next.geocodedAt = new Date().toISOString();
      next.geocodedFrom = cle;
    }
    next.enabled = true;
  }

  await supabase().from("merchants")
    .update({ wallet_config: { ...walletConfig, geofencing: next } })
    .eq("id", tenantId);

  // Les passes déjà installés ne connaissent pas encore le lieu : on les
  // repousse. Sans attendre — un commerçant avec 300 clients n'a pas à
  // regarder tourner un spinner.
  walletNotificationService.refreshTenantPasses(tenantId).catch(console.error);

  return NextResponse.json({
    ok: true,
    enabled: Boolean(next.enabled),
    message: next.message,
    label: next.label ?? null,
    latitude: next.latitude ?? null,
    longitude: next.longitude ?? null,
  });
}
