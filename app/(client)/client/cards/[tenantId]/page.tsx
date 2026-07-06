import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { findClientCards } from "@/lib/client-lookup";
import { resolveClientSession } from "@/lib/client-sessions";
import { ChevronLeft } from "lucide-react";
import RedeemSection from "./RedeemSection";
import WalletButton from "./WalletButton";
import AutoRefresh from "./AutoRefresh";
import ReferralSection from "./ReferralSection";

export default async function TenantCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ ccid?: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("comeback_client")?.value;
  const email = token ? await resolveClientSession(token) : null;
  if (!email) redirect("/client/login");

  const { tenantId } = await params;
  const { ccid } = await searchParams;

  const allCards = await findClientCards(email);
  const card = allCards.find(
    (c) => c.tenantId === tenantId && (!ccid || c.customerCardId === ccid),
  );
  if (!card) notFound();

  const isStamps = card.loyaltyMode === "stamps";
  const stampsDisplay = Math.min(card.stamps, card.stampsRequired);

  const qrDataUrl = await QRCode.toDataURL(card.customerCardId, {
    width: 200,
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  });

  const bg = card.backgroundColor;
  const accent = card.accentColor;

  return (
    <div>
      <AutoRefresh />
      <Link
        href="/client/cards"
        className="inline-flex items-center gap-1 text-[13px] text-gray-500 hover:text-gray-800 transition-colors mb-6"
      >
        <ChevronLeft className="h-4 w-4" /> Mes cartes
      </Link>

      {/* Carte fidélité — design fixe */}
      <div
        className="relative w-full rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: bg, minHeight: "520px" }}
      >
        {/* Cercle déco fond */}
        <div
          className="absolute -top-16 -right-16 h-64 w-64 rounded-full opacity-10"
          style={{ background: accent }}
        />
        <div
          className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full opacity-[0.07]"
          style={{ background: accent }}
        />

        <div className="relative z-10 flex flex-col p-7 gap-6">

          {/* Header : logo + ComeBack */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {card.logoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={card.logoUrl} alt={card.storeName} className="h-10 w-10 rounded-xl object-cover" />
              ) : (
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center text-[13px] font-bold"
                  style={{ background: accent + "30", color: accent, border: `1.5px solid ${accent}50` }}
                >
                  {card.storeName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-white font-bold text-[15px] leading-none">{card.storeName}</p>
                {card.storeCity && <p className="text-[11px] mt-0.5" style={{ color: accent + "cc" }}>{card.storeCity}</p>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: accent }}>ComeBack</p>
              <p className="text-[9px] uppercase tracking-widest text-white/40">Fidélité</p>
            </div>
          </div>

          {/* Séparateur */}
          <div className="h-px w-full" style={{ background: accent + "30" }} />

          {/* Tampons ou Points */}
          {isStamps ? (
            <div className="flex flex-col items-center gap-4">
              <div className="text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: accent }}>Vos visites</p>
                <p className="text-[38px] font-bold text-white leading-none mt-1">
                  {stampsDisplay}
                  <span className="text-[22px] text-white/40 font-normal"> / {card.stampsRequired}</span>
                </p>
              </div>
              {/* Grille de tampons */}
              <div className="flex flex-wrap justify-center gap-2.5">
                {Array.from({ length: card.stampsRequired }).map((_, i) => (
                  <div
                    key={i}
                    className="h-9 w-9 rounded-full flex items-center justify-center transition-all"
                    style={
                      i < stampsDisplay
                        ? { background: accent, boxShadow: `0 0 8px ${accent}80` }
                        : { border: `2px dashed ${accent}40` }
                    }
                  >
                    {i < stampsDisplay && (
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" style={{ color: bg }}>
                        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: accent }}>Vos points</p>
              <p className="text-[52px] font-bold text-white leading-none">{card.points.toLocaleString("fr-FR")}</p>
              <p className="text-[12px] text-white/40">points cumulés</p>
            </div>
          )}

          {/* Séparateur */}
          <div className="h-px w-full" style={{ background: accent + "30" }} />

          {/* QR Code */}
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-2xl bg-white p-3 shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR Code fidélité" className="h-36 w-36" />
            </div>
            <p className="text-[11px] text-white/40">Présentez ce code en caisse</p>
          </div>

          {/* Nom client en bas */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/30">Titulaire</p>
              <p className="text-[14px] font-semibold text-white">{card.customerName}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-white/30">Programme</p>
              <p className="text-[12px] font-medium" style={{ color: accent }}>{card.cardName}</p>
            </div>
          </div>

        </div>
      </div>

      <RedeemSection card={card} customerCardId={card.customerCardId} />

      <WalletButton ccId={card.customerCardId} />

      {card.referral?.enabled && (
        <ReferralSection
          cardId={card.cardId}
          cardName={card.cardName}
          loyaltyMode={card.loyaltyMode}
          stampsRequired={card.stampsRequired}
          pointsPerEuro={card.pointsPerEuro}
          welcomePoints={card.welcomePoints}
          welcomeMessage={card.welcomeMessage}
          backgroundColor={card.backgroundColor}
          accentColor={card.accentColor}
          customerCardId={card.customerCardId}
          referral={card.referral}
          referralCount={card.referralCount}
          referralPoints={card.referralPoints}
        />
      )}
    </div>
  );
}
