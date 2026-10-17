import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { GAME_META, GameKey } from "@/lib/games";
import { getGameConfigs, getPlays } from "@/lib/games-db";

/**
 * Chiffres des jeux. Volontairement resserré : les quatre nombres qu'on
 * regarde vraiment, la courbe des parties, la répartition des gains, et
 * les dernières parties. Rien d'autre — un tableau de bord qu'on ne lit
 * pas ne sert à personne.
 */

export async function GET(req: NextRequest) {
  const session = await auth();
  const tenantId = session?.user?.id;
  if (!tenantId || tenantId === "admin") {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const periode = req.nextUrl.searchParams.get("period") ?? "30";
  const jeu = req.nextUrl.searchParams.get("game");
  const jours = periode === "all" ? null : Number(periode) || 30;
  const depuis = jours ? new Date(Date.now() - jours * 86400_000).toISOString() : undefined;

  const [toutes, configs] = await Promise.all([getPlays(tenantId, depuis), getGameConfigs(tenantId)]);
  const plays = jeu ? toutes.filter((p) => p.gameKey === jeu) : toutes;

  const gagnantes = plays.filter((p) => p.resultType === "win");
  const participants = new Set(plays.map((p) => p.customerId)).size;
  const depense = plays.reduce((s, p) => s + p.cost, 0);

  // Répartition des gains, avec la probabilité réglée en face du taux
  // réellement observé : c'est là qu'on voit si un lot sort trop souvent.
  const parRecompense = new Map<string, { name: string; emoji: string; count: number }>();
  for (const p of gagnantes) {
    const cle = p.rewardId ?? "?";
    const e = parRecompense.get(cle) ?? { name: p.rewardName ?? "Récompense", emoji: p.rewardEmoji ?? "🎁", count: 0 };
    e.count++;
    parRecompense.set(cle, e);
  }

  const configsVisibles = jeu ? configs.filter((c) => c.gameKey === jeu) : configs;

  // La probabilité réglée n'est comparable au taux observé que sur UN jeu :
  // additionner les réglages des trois jeux donnerait un « 75 % » qui ne
  // correspond à rien. Hors filtre, on n'affiche donc pas de référence.
  const probaParRecompense = new Map<string, number>();
  if (jeu) {
    for (const c of configsVisibles) {
      for (const pr of c.prizes) probaParRecompense.set(pr.rewardId, pr.probability);
    }
  }

  const repartition = [...parRecompense.entries()].map(([rewardId, v]) => ({
    rewardId,
    name: v.name,
    emoji: v.emoji,
    count: v.count,
    observed: plays.length ? Math.round((v.count / plays.length) * 1000) / 10 : 0,
    configured: probaParRecompense.get(rewardId) ?? null,
  })).sort((a, b) => b.count - a.count);

  // Courbe des parties par jour, trous compris : une courbe à trous laisse
  // croire à une activité continue qui n'existe pas.
  const parJour = new Map<string, number>();
  const span = jours ?? 30;
  for (let i = span - 1; i >= 0; i--) {
    parJour.set(new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10), 0);
  }
  for (const p of plays) {
    const j = p.playedAt.slice(0, 10);
    if (parJour.has(j)) parJour.set(j, (parJour.get(j) ?? 0) + 1);
  }

  const parJeu = (Object.keys(GAME_META) as GameKey[]).map((k) => {
    const sub = toutes.filter((p) => p.gameKey === k);
    const c = configs.find((x) => x.gameKey === k);
    return {
      gameKey: k,
      ...GAME_META[k],
      enabled: Boolean(c?.enabled),
      plays: sub.length,
      wins: sub.filter((p) => p.resultType === "win").length,
      spent: sub.reduce((s, p) => s + p.cost, 0),
    };
  });

  // Stock restant, pour voir d'un coup d'œil ce qui va s'épuiser.
  // Le stock est propre à chaque jeu : un même lot peut être limité à 20
  // sur la roue et illimité ailleurs. On nomme donc le jeu concerné.
  const stocks = configsVisibles.flatMap((c) =>
    c.prizes.filter((p) => p.stock !== null).map((p) => ({
      gameKey: c.gameKey,
      gameName: GAME_META[c.gameKey]?.name ?? c.gameKey,
      rewardId: p.rewardId,
      name: parRecompense.get(p.rewardId)?.name ?? p.rewardId,
      remaining: Math.max(0, (p.stock ?? 0) - (p.wonCount ?? 0)),
      stock: p.stock ?? 0,
    })),
  );

  return NextResponse.json({
    kpi: {
      plays: plays.length,
      participants,
      spent: depense,
      wins: gagnantes.length,
      winRate: plays.length ? Math.round((gagnantes.length / plays.length) * 1000) / 10 : 0,
      used: gagnantes.filter((p) => p.usedAt).length,
      pending: gagnantes.filter((p) => !p.usedAt).length,
    },
    perDay: [...parJour.entries()].map(([date, count]) => ({ date, count })),
    breakdown: repartition,
    perGame: parJeu,
    stocks,
    recent: plays.slice(0, 25).map((p) => ({
      playedAt: p.playedAt,
      game: GAME_META[p.gameKey]?.name ?? p.gameKey,
      result: p.resultType === "win" ? `${p.rewardEmoji ?? "🎁"} ${p.rewardName}` : "Perdu",
      win: p.resultType === "win",
      used: Boolean(p.usedAt),
      code: p.prizeCode ? p.prizeCode.slice(0, 8).toUpperCase() : null,
    })),
  });
}
