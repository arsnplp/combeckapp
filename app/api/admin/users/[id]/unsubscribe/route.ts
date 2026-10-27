import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import { notifyAdminEmail } from "@/lib/mailer";
import { suspendedPlanFields } from "@/lib/plan-billing";

/**
 * Arrête l'abonnement d'un commerçant sans supprimer son compte.
 *
 * Par défaut la résiliation prend effet à la fin de la période déjà réglée :
 * plus aucun prélèvement, mais le commerçant garde le plan qu'il a payé
 * jusqu'à son terme, puis son compte est suspendu. Couper immédiatement
 * quelqu'un qui vient de régler son mois, c'est la demande de remboursement
 * ou la contestation bancaire assurée.
 *
 * `immediate` existe pour les cas d'abus : l'abonnement s'arrête sur-le-champ
 * et le compte est suspendu dans la foulée.
 *
 * À NE PAS CONFONDRE avec la fin de période : là, le cron d'expiration
 * repasse le plan à `free`, et un compte `free` expiré est redirigé vers
 * /bloque jusqu'à ce que le commerçant choisisse un plan. C'est voulu
 * (voir app/bloque/page.tsx) : il n'y a plus de plan gratuit, le commerçant
 * reprend avec Pro ou Business et retrouve ses données intactes.
 *
 * `resume` fait marche arrière sur une résiliation programmée mais pas encore
 * effective — une erreur de ligne se rattrape depuis la console, sans passer
 * par le tableau de bord Stripe.
 *
 * Rien n'est supprimé : les clients, les cartes et l'historique restent, et
 * le commerçant peut se réabonner quand il veut.
 */

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("stripe")(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const { id } = await params;
  let immediate = false;
  let resume = false;
  try {
    const body = await req.json();
    immediate = Boolean(body?.immediate);
    resume = Boolean(body?.resume);
  } catch { /* corps vide : résiliation en fin de période */ }

  const sb = supabase();
  const { data: m } = await sb
    .from("merchants")
    .select("id, email, store_name, plan, is_admin, stripe_customer_id")
    .eq("id", id)
    .maybeSingle();
  if (!m) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  if (m.is_admin) return NextResponse.json({ error: "Compte administrateur." }, { status: 400 });

  const stripe = getStripe();
  let canceled = 0;
  let endsAt: string | null = null;

  if (stripe && m.stripe_customer_id) {
    try {
      const subs = await stripe.subscriptions.list({ customer: m.stripe_customer_id, limit: 10 });
      for (const s of subs.data) {
        if (s.status === "canceled" || s.status === "incomplete_expired") continue;
        if (resume) {
          // Rien à reprendre si aucune résiliation n'était programmée.
          if (!s.cancel_at_period_end) continue;
          await stripe.subscriptions.update(s.id, { cancel_at_period_end: false });
        } else if (immediate) {
          await stripe.subscriptions.cancel(s.id);
        } else {
          const updated = await stripe.subscriptions.update(s.id, { cancel_at_period_end: true });
          // Un essai en cours se termine à `trial_end`, pas à la fin d'une
          // période facturée qui n'existe pas encore.
          const ts = updated.cancel_at ?? updated.trial_end ?? updated.current_period_end;
          if (ts) {
            const d = new Date(ts * 1000).toISOString();
            if (!endsAt || d > endsAt) endsAt = d;
          }
        }
        canceled++;
      }
    } catch (e) {
      console.error("[unsubscribe] Stripe", e);
      return NextResponse.json(
        { error: "Stripe a refusé la résiliation. Rien n'a été changé." },
        { status: 502 },
      );
    }
  }

  const wasPaying = m.plan === "pro" || m.plan === "business";

  if (resume) {
    // Reprise : le plan et sa date d'échéance sont déjà corrects, c'est
    // `invoice.paid` qui les repoussera au prochain prélèvement. Surtout,
    // ne rien redescendre ici — ce bloc sert à arrêter, pas à reprendre.
  } else if (immediate) {
    // Suspension immédiate (plus de plan gratuit). `trial_ends_at` est remis
    // à zéro : sinon l'interface continuerait d'annoncer un essai en cours.
    await sb.from("merchants")
      .update({ ...suspendedPlanFields(), trial_ends_at: null })
      .eq("id", id);
  } else if (canceled > 0 && endsAt) {
    // L'accès court jusqu'à la date déjà réglée. Trois jours de battement,
    // comme pour un paiement, pour qu'un décalage d'horloge ne coupe pas
    // l'accès une heure trop tôt.
    const until = new Date(new Date(endsAt).getTime() + 3 * 86400_000).toISOString();
    await sb.from("merchants").update({ plan_expires_at: until }).eq("id", id);
  } else if (canceled === 0 && wasPaying) {
    // Plan payant accordé à la main, sans abonnement Stripe : il n'y a rien
    // à résilier chez Stripe, seul le plan en base est à arrêter.
    await sb.from("merchants")
      .update(suspendedPlanFields())
      .eq("id", id);
  }

  const action = resume ? "Reprise d'abonnement" : "Abonnement arrêté";
  console.log(`[admin] ${action} : ${m.store_name} <${m.email}> (${canceled} abonnement(s))`);
  notifyAdminEmail(action, {
    Commerce: m.store_name ?? "—",
    Email: m.email,
    Plan: m.plan ?? "—",
    Effet: resume ? "résiliation annulée" : immediate ? "immédiat" : endsAt ? `fin de période (${endsAt.slice(0, 10)})` : "immédiat",
    "Abonnements concernés": String(canceled),
    "Par": session.user?.email ?? "admin",
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    storeName: m.store_name,
    canceled,
    immediate,
    resume,
    endsAt,
    // Rien côté Stripe ni côté plan : il n'y avait tout simplement pas
    // d'abonnement à arrêter, ou pas de résiliation à reprendre.
    noop: canceled === 0 && (resume || !wasPaying),
  });
}
