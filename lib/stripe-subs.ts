/**
 * Abonnements Stripe « vivants » d'un client.
 *
 * `subscriptions.list({ status: "active" })` ne renvoie PAS les abonnements
 * en période d'essai : Stripe leur donne le statut `trialing`. Toutes les
 * vérifications faites avec ce filtre passaient donc à côté de l'essai
 * 30 jours, avec deux conséquences bien réelles :
 *
 *  — un commerçant en essai qui choisissait Starter voyait son plan basculer
 *    en gratuit, mais son abonnement d'essai n'était pas résilié : Stripe le
 *    prélevait quand même 39,99 € au terme des 30 jours ;
 *  — un commerçant en essai qui passait à Pro se retrouvait avec DEUX
 *    abonnements, au lieu d'être renvoyé vers le portail de gestion.
 *
 * On liste donc sans filtre et on écarte nous-mêmes ce qui ne prélèvera
 * plus jamais rien.
 */

/** Statuts qui donnent (ou donneront) lieu à un prélèvement. */
const STATUTS_VIVANTS = new Set(["trialing", "active", "past_due", "unpaid"]);

export interface StripeSub {
  id: string;
  status: string;
  items?: { data?: Array<{ id: string }> };
}
interface StripeLike {
  subscriptions: { list(p: { customer: string; limit: number }): Promise<{ data: StripeSub[] }> };
}

/** Un essai en cours : il porte deja une carte, rien n'a encore ete preleve. */
export function enEssai(sub: StripeSub | undefined): boolean {
  return sub?.status === "trialing";
}

export async function listLiveSubscriptions(
  stripe: StripeLike,
  customerId: string,
): Promise<StripeSub[]> {
  const subs = await stripe.subscriptions.list({ customer: customerId, limit: 20 });
  return subs.data.filter((s) => STATUTS_VIVANTS.has(s.status));
}
