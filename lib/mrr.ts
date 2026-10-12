/**
 * Revenu réellement encaissé chaque mois, par commerçant.
 *
 * Le plan inscrit en base ne suffit pas : un commerçant en essai y figure
 * déjà comme « business » sans rien payer, et un code promo appliqué sur
 * l'abonnement n'y apparaît nulle part. Le prix catalogue gonflait donc le
 * MRR des deux côtés. La seule source de vérité est l'abonnement Stripe.
 */

export type RevenueStatus =
  /** Abonnement en cours, payé. */
  | "payant"
  /** Essai en cours : rien n'est encaissé, mais le montant est connu. */
  | "essai"
  /** Paiement en échec : l'argent n'est pas encaissé non plus. */
  | "impayé"
  /** Plan payant en base mais aucun abonnement Stripe : montant estimé. */
  | "estimé"
  /** Plan gratuit. */
  | "aucun";

export interface MerchantRevenue {
  /** Ce qui est encaissé chaque mois, remises récurrentes déduites. */
  monthly: number;
  /** Le même montant sans remise, pour pouvoir afficher l'écart. */
  monthlyFull: number;
  status: RevenueStatus;
  /** Libellé de la remise en cours, ex. « -50 % à vie ». */
  discountLabel: string | null;
  /** Mensuel ou annuel, pour l'afficher sans se tromper. */
  interval: "month" | "year" | null;
  /** Résiliation déjà programmée : il paie encore, mais il part. */
  cancelAt: string | null;
  /** Prochain prélèvement : fin d'essai, ou prochaine échéance. */
  nextChargeAt: string | null;
}

type StripeLike = {
  subscriptions: {
    list: (p: Record<string, unknown>) => Promise<{ data: StripeSub[]; has_more: boolean }>;
  };
};

interface StripeSub {
  id: string;
  status: string;
  customer: string | { id: string };
  cancel_at_period_end?: boolean;
  cancel_at?: number | null;
  current_period_end?: number;
  trial_end?: number | null;
  items?: { data?: Array<{ quantity?: number; price?: { unit_amount?: number; recurring?: { interval?: string; interval_count?: number } } }> };
  discount?: { coupon?: { percent_off?: number | null; amount_off?: number | null; duration?: string; duration_in_months?: number | null } } | null;
}

/** Ramène n'importe quelle périodicité à un montant mensuel. */
function toMonthly(amount: number, interval?: string, count = 1): number {
  const n = count || 1;
  if (interval === "year") return amount / (12 * n);
  if (interval === "week") return (amount * 52) / (12 * n);
  if (interval === "day") return (amount * 365) / (12 * n);
  return amount / n;
}

/**
 * Applique la remise à un montant mensuel.
 *
 * Une remise « once » ne vaut que pour la facture suivante : elle ne change
 * pas le revenu récurrent et n'entre donc pas dans le MRR. Les remises
 * « forever » et « repeating » sont bien ce que le commerçant paiera au
 * prochain prélèvement, elles comptent.
 */
function applyDiscount(
  monthly: number,
  coupon: NonNullable<NonNullable<StripeSub["discount"]>["coupon"]> | undefined,
): { monthly: number; label: string | null } {
  if (!coupon || coupon.duration === "once") return { monthly, label: null };

  const suffix =
    coupon.duration === "forever"
      ? "à vie"
      : coupon.duration_in_months
        ? `pendant ${coupon.duration_in_months} mois`
        : "";

  if (coupon.percent_off) {
    return {
      monthly: monthly * (1 - coupon.percent_off / 100),
      label: `-${coupon.percent_off} %${suffix ? " " + suffix : ""}`,
    };
  }
  if (coupon.amount_off) {
    const off = coupon.amount_off / 100;
    return {
      monthly: Math.max(0, monthly - off),
      label: `-${off.toLocaleString("fr-FR")} €${suffix ? " " + suffix : ""}`,
    };
  }
  return { monthly, label: null };
}

/** Revenu mensuel porté par un abonnement Stripe. */
export function revenueFromSubscription(sub: StripeSub): MerchantRevenue {
  const item = sub.items?.data?.[0];
  const unit = (item?.price?.unit_amount ?? 0) / 100;
  const quantity = item?.quantity ?? 1;
  const interval = (item?.price?.recurring?.interval ?? "month") as "month" | "year";
  const monthlyFull = toMonthly(unit * quantity, interval, item?.price?.recurring?.interval_count ?? 1);
  const { monthly, label } = applyDiscount(monthlyFull, sub.discount?.coupon ?? undefined);

  // `trialing` : le montant est connu mais rien n'est encaissé.
  // `past_due` / `unpaid` : un renouvellement a échoué.
  // `incomplete` : le tout premier paiement n'est jamais passé — le compte
  // affiche un plan payant alors que rien n'a été encaissé. C'est le cas le
  // plus trompeur, il doit se voir.
  // `canceled` / `incomplete_expired` : plus rien à attendre.
  const status: RevenueStatus =
    sub.status === "trialing" ? "essai"
    : sub.status === "past_due" || sub.status === "unpaid" || sub.status === "incomplete" ? "impayé"
    : sub.status === "active" ? "payant"
    : "aucun";

  // Résiliation programmée : l'échéance est `cancel_at` quand Stripe l'a
  // posée, sinon la fin de la période en cours.
  const cancelTs = sub.cancel_at ?? (sub.cancel_at_period_end ? sub.current_period_end ?? null : null);

  // Date du prochain prélèvement : la fin de l'essai pour un essai, la fin
  // de la période en cours sinon. Nulle si une résiliation est programmée :
  // il n'y aura justement plus de prélèvement.
  const nextTs = cancelTs ? null
    : sub.status === "trialing" ? sub.trial_end ?? sub.current_period_end ?? null
    : sub.status === "active" ? sub.current_period_end ?? null
    : null;

  return {
    // Un abonnement résilié ou expiré ne rapporte plus rien : le montant
    // doit tomber à zéro, sinon la ligne affiche un encaissement qui
    // n'existe plus. `monthlyFull` garde le prix pour mémoire.
    monthly: status === "aucun" ? 0 : monthly,
    monthlyFull, status, discountLabel: label, interval,
    cancelAt: cancelTs ? new Date(cancelTs * 1000).toISOString() : null,
    nextChargeAt: nextTs ? new Date(nextTs * 1000).toISOString() : null,
  };
}

/**
 * Revenu de chaque commerçant, indexé par identifiant de commerçant.
 *
 * Une seule série d'appels Stripe pour tout le monde : la console se
 * rafraîchit en boucle, un appel par commerçant la rendrait inutilisable.
 */
export async function revenueByMerchant(
  stripe: StripeLike | null,
  merchants: Array<{ id: string; plan: string; stripeCustomerId: string | null }>,
  listPrice: (plan: string) => number,
): Promise<Map<string, MerchantRevenue>> {
  const out = new Map<string, MerchantRevenue>();

  const byCustomer = new Map<string, StripeSub>();
  if (stripe) {
    try {
      let startingAfter: string | undefined;
      for (let page = 0; page < 20; page++) {
        const res = await stripe.subscriptions.list({
          status: "all",
          limit: 100,
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        });
        for (const s of res.data) {
          const cid = typeof s.customer === "string" ? s.customer : s.customer?.id;
          if (!cid) continue;
          // Plusieurs abonnements pour un même client : on garde celui qui
          // rapporte, pas un ancien abonnement résilié.
          const prev = byCustomer.get(cid);
          const rank = (x: StripeSub) =>
            x.status === "active" ? 3 : x.status === "trialing" ? 2 : x.status === "past_due" ? 1 : 0;
          if (!prev || rank(s) > rank(prev)) byCustomer.set(cid, s);
        }
        if (!res.has_more || res.data.length === 0) break;
        startingAfter = res.data[res.data.length - 1].id;
      }
    } catch (e) {
      // Stripe indisponible : on retombe sur les prix catalogue plutôt que
      // d'afficher un MRR à zéro, qui serait plus trompeur qu'approximatif.
      console.error("[mrr] Stripe injoignable, estimation sur les prix catalogue", e);
    }
  }

  for (const m of merchants) {
    const sub = m.stripeCustomerId ? byCustomer.get(m.stripeCustomerId) : undefined;
    if (sub) {
      out.set(m.id, revenueFromSubscription(sub));
      continue;
    }
    const price = listPrice(m.plan);
    out.set(m.id, {
      monthly: price,
      monthlyFull: price,
      // Un plan payant sans abonnement Stripe : accordé à la main, ou
      // abonnement créé hors de l'application. Le montant reste une
      // estimation, on le dit plutôt que de le faire passer pour sûr.
      status: price > 0 ? "estimé" : "aucun",
      discountLabel: null,
      interval: price > 0 ? "month" : null,
      cancelAt: null,
      nextChargeAt: null,
    });
  }

  return out;
}

/** Les totaux affichés en haut de la console. */
export function summarize(revenues: Iterable<MerchantRevenue>) {
  let mrr = 0, trial = 0, unpaid = 0, discounts = 0, estimated = 0;
  for (const r of revenues) {
    if (r.status === "payant" || r.status === "estimé") {
      mrr += r.monthly;
      discounts += r.monthlyFull - r.monthly;
      if (r.status === "estimé") estimated += r.monthly;
    } else if (r.status === "essai") {
      trial += r.monthly;
    } else if (r.status === "impayé") {
      unpaid += r.monthly;
    }
  }
  return { mrr, trial, unpaid, discounts, estimated };
}
