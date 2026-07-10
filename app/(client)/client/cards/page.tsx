import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { findClientCards } from "@/lib/client-lookup";
import { resolveClientSession } from "@/lib/client-sessions";
import { ChevronRight, Stamp, Star } from "lucide-react";
import LogoutButton from "./LogoutButton";
import RefreshButton from "./RefreshButton";
import GdprSection from "./GdprSection";
import AddToHomeScreen from "./AddToHomeScreen";

export default async function CardsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("comeback_client")?.value;
  const email = token ? await resolveClientSession(token) : null;
  if (!email) redirect("/client/login");

  const cards = await findClientCards(email);
  if (cards.length === 0) redirect("/client/login");

  const clientName = cards[0].customerName;

  return (
    <div>
      <AddToHomeScreen />
      <div className="mb-6">
        <p className="text-[13px] text-gray-400 font-medium">Bonjour 👋</p>
        <h1 className="text-[22px] font-bold text-gray-900 mt-0.5">{clientName}</h1>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-[13px] text-gray-500">{cards.length} carte{cards.length > 1 ? "s" : ""} de fidélité</p>
          <RefreshButton />
        </div>
      </div>

      <div className="space-y-3">
        {cards.map((card) => {
          const isStamps = card.loyaltyMode === "stamps";
          const progress = isStamps
            ? Math.min(card.stamps / card.stampsRequired, 1)
            : 0;
          const canRedeem = card.rewards.some((r) => {
            if (r.mode === "stamps") return card.stamps >= r.cost;
            return card.points >= r.cost;
          });

          return (
            <Link
              key={card.customerCardId}
              href={`/client/cards/${card.tenantId}?ccid=${card.customerCardId}`}
              className="block rounded-2xl bg-white border border-gray-100 p-4 hover:border-gray-200 hover:shadow-sm transition-all active:scale-[0.99]"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0"
                    style={{ backgroundColor: card.accentColor }}
                  >
                    {card.storeName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-gray-900">{card.storeName}</p>
                    {card.storeCity && <p className="text-[12px] text-gray-400">{card.storeCity}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {canRedeem && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
                      Récompense dispo
                    </span>
                  )}
                  {card.walletAdded ? (
                    <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
                      ✓ Wallet
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
                      📲 À ajouter au Wallet
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-gray-300" />
                </div>
              </div>

              <p className="text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wide">{card.cardName}</p>

              {isStamps ? (
                <div>
                  <div className="flex items-center justify-between text-[12px] mb-1.5">
                    <span className="text-gray-500 flex items-center gap-1">
                      <Stamp className="h-3.5 w-3.5" /> Tampons
                    </span>
                    <span className="font-semibold text-gray-800">{card.stamps}/{card.stampsRequired}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${progress * 100}%`, backgroundColor: card.accentColor }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-[16px] font-bold text-gray-900">{card.points.toLocaleString("fr-FR")}</span>
                  <span className="text-[12px] text-gray-400">points</span>
                </div>
              )}

              {(card.referral?.enabled || card.referralPoints > 0) && (
                <div className="mt-2 flex items-center gap-1.5 text-[12px]">
                  <span>🤝</span>
                  <span className="font-semibold text-gray-800">{card.referralPoints}</span>
                  <span className="text-gray-400">
                    point{card.referralPoints > 1 ? "s" : ""} de parrainage
                    {card.referralCount > 0 && ` · ${card.referralCount} ami${card.referralCount > 1 ? "s" : ""} parrainé${card.referralCount > 1 ? "s" : ""}`}
                  </span>
                </div>
              )}
            </Link>
          );
        })}
      </div>

      <GdprSection />
      <LogoutButton />
    </div>
  );
}
