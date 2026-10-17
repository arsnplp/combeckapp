import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { findClientCards } from "@/lib/client-lookup";
import { resolveClientSession } from "@/lib/client-sessions";
import { ChevronRight, Stamp, Star } from "lucide-react";
import LogoutButton from "./LogoutButton";
import GdprSection from "./GdprSection";
import AddToHomeScreen from "./AddToHomeScreen";
import AutoRefresh from "./AutoRefresh";
import ScanStoreButton from "./ScanStoreButton";

export default async function CardsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("comeback_client")?.value;
  const email = token ? await resolveClientSession(token) : null;
  if (!email) redirect("/client/login");

  const cards = await findClientCards(email);

  // Aucune carte (ex : a quitté son dernier commerce) — état vide, PAS de
  // redirect vers /client/login (qui renvoie ici quand la session est active)
  if (cards.length === 0) {
    return (
      <div className="pt-8 text-center">
        <p className="text-[15px] font-semibold text-gray-900">Aucune carte pour l'instant</p>
        <p className="mt-2 text-[13px] leading-relaxed text-gray-500">
          Scannez le QR code d'un commerce partenaire pour activer votre première carte de fidélité.
        </p>
        <div className="mx-auto mt-5 max-w-xs">
          <ScanStoreButton />
        </div>
        <div className="mt-8">
          <LogoutButton />
        </div>
      </div>
    );
  }

  const clientName = cards[0].customerName;

  return (
    <div>
      <AutoRefresh />
      <AddToHomeScreen />
      <div className="mb-6">
        <p className="text-[13px] text-gray-400 font-medium">Bonjour 👋</p>
        <h1 className="text-[22px] font-bold text-gray-900 mt-0.5">{clientName}</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">{cards.length} carte{cards.length > 1 ? "s" : ""} de fidélité</p>
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
              {/* Le nom et les pastilles sur deux lignes : côte à côte, les
                  pastilles refusaient de rétrécir et écrasaient le nom du
                  commerce sur trois lignes dès qu'il était un peu long. */}
              <div className="mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0"
                    style={{ backgroundColor: card.accentColor }}
                  >
                    {card.storeName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-gray-900">{card.storeName}</p>
                    {card.storeCity && <p className="truncate text-[12px] text-gray-400">{card.storeCity}</p>}
                  </div>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-300" />
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {canRedeem && (
                    <span className="whitespace-nowrap rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                      Récompense dispo
                    </span>
                  )}
                  {card.walletAdded ? (
                    <span className="whitespace-nowrap rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                      ✓ Wallet
                    </span>
                  ) : (
                    <span className="whitespace-nowrap rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                      📲 À ajouter au Wallet
                    </span>
                  )}
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

              {card.referralCount > 0 && (
                <div className="mt-2 flex items-center gap-1.5 text-[12px]">
                  <span>🤝</span>
                  <span className="font-semibold text-gray-800">{card.referralCount}</span>
                  <span className="text-gray-400">
                    ami{card.referralCount > 1 ? "s" : ""} parrainé{card.referralCount > 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </Link>
          );
        })}
      </div>

      <ScanStoreButton />

      <GdprSection />
      <LogoutButton />
    </div>
  );
}
