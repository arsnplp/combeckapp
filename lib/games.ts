/**
 * Module Jeux — moteur partagé par les trois habillages.
 *
 * Le tirage se fait toujours côté serveur. L'animation du front ne fait
 * qu'afficher un résultat déjà décidé : sans ça, n'importe quel client
 * pourrait rejouer jusqu'à gagner en bidouillant la page.
 */

export const GAME_KEYS = ["wheel", "scratch", "chests"] as const;
export type GameKey = (typeof GAME_KEYS)[number];

export const GAME_META: Record<GameKey, { name: string; emoji: string; tagline: string }> = {
  wheel:   { name: "Roue de la fortune", emoji: "🎡", tagline: "Elle tourne, elle ralentit, elle s'arrête sur votre lot" },
  scratch: { name: "Carte à gratter",    emoji: "🎫", tagline: "Grattez avec le doigt pour découvrir votre lot" },
  chests:  { name: "Coffres mystère",    emoji: "🎁", tagline: "Trois coffres, un seul à ouvrir" },
};

export interface GamePrizeConfig {
  rewardId: string;
  /** Probabilité en pourcentage, nombre entier. */
  probability: number;
  /** Nombre maximum de fois gagnable via ce jeu. `null` = illimité. */
  stock: number | null;
  wonCount: number;
}

export interface GameConfig {
  gameKey: GameKey;
  enabled: boolean;
  cost: number;
  costType: "stamps" | "points";
  dailyLimit: number;
  loseProbability: number;
  prizes: GamePrizeConfig[];
}

export function defaultConfig(gameKey: GameKey): GameConfig {
  return {
    gameKey,
    enabled: false,
    cost: 2,
    costType: "stamps",
    dailyLimit: 3,
    loseProbability: 40,
    prizes: [],
  };
}

/** Une récompense de la base, telle que le jeu en a besoin. */
export interface RewardRef {
  id: string;
  name: string;
  emoji: string;
  active?: boolean;
}

export interface ConfigValidation {
  valid: boolean;
  total: number;
  errors: string[];
  /** Lots pointant sur une récompense disparue ou désactivée. */
  orphans: string[];
}

/**
 * Un jeu ne peut pas être activé tant que sa configuration ne tient pas
 * debout : total à 100 %, au moins un vrai lot, et aucun lot pointant
 * dans le vide.
 */
export function validateConfig(config: GameConfig, rewards: RewardRef[]): ConfigValidation {
  const errors: string[] = [];
  const known = new Map(rewards.map((r) => [r.id, r]));

  const orphans = config.prizes
    .filter((p) => {
      const r = known.get(p.rewardId);
      return !r || r.active === false;
    })
    .map((p) => p.rewardId);

  const total = config.prizes.reduce((s, p) => s + (p.probability || 0), 0) + (config.loseProbability || 0);

  if (config.prizes.length === 0) {
    errors.push("Ajoutez au moins une récompense à gagner.");
  }
  if (total !== 100) {
    errors.push(`Le total des chances fait ${total} % — il doit faire exactement 100 %.`);
  }
  if (config.prizes.some((p) => p.probability <= 0)) {
    errors.push("Une récompense à 0 % ne sera jamais gagnée : retirez-la ou donnez-lui une chance.");
  }
  if (orphans.length > 0) {
    errors.push("Une récompense utilisée dans ce jeu a été supprimée ou désactivée.");
  }
  if (config.cost < 1) {
    errors.push("Le coût d'une partie doit être d'au moins 1.");
  }

  return { valid: errors.length === 0, total, errors, orphans };
}

export interface DrawOutcome {
  type: "win" | "lose";
  rewardId?: string;
}

/**
 * Tire un résultat.
 *
 * Les lots épuisés ou orphelins sortent du tirage, et les probabilités
 * restantes sont renormalisées sur ce qui reste — « Perdu » compris. Sans
 * cette renormalisation, un stock épuisé ferait silencieusement grimper la
 * part de perdant au-delà de ce que le commerçant a réglé.
 *
 * `random` est injectable pour pouvoir tester la distribution.
 */
export function draw(
  config: GameConfig,
  rewards: RewardRef[],
  random: () => number = Math.random,
): DrawOutcome {
  const known = new Map(rewards.map((r) => [r.id, r]));

  const disponibles = config.prizes.filter((p) => {
    const r = known.get(p.rewardId);
    if (!r || r.active === false) return false;
    if (p.stock !== null && p.wonCount >= p.stock) return false;
    return p.probability > 0;
  });

  const segments: Array<{ poids: number; outcome: DrawOutcome }> = [
    ...disponibles.map((p) => ({ poids: p.probability, outcome: { type: "win" as const, rewardId: p.rewardId } })),
    { poids: Math.max(0, config.loseProbability), outcome: { type: "lose" as const } },
  ];

  const total = segments.reduce((s, x) => s + x.poids, 0);
  // Plus rien à gagner et aucune part de perdant : la partie est perdue.
  if (total <= 0) return { type: "lose" };

  let tirage = random() * total;
  for (const s of segments) {
    tirage -= s.poids;
    if (tirage < 0) return s.outcome;
  }
  return segments[segments.length - 1].outcome;
}

/**
 * Reste-t-il au moins un lot gagnable (stock non épuisé) ? Sans lot, une
 * partie est perdue d'avance : le client ne doit pas pouvoir payer pour.
 */
export function hasWinnablePrize(config: GameConfig, rewards: RewardRef[]): boolean {
  return effectiveOdds(config, rewards).some((o) => o.rewardId !== null);
}

/** Chances réellement offertes au client, après retrait des lots épuisés. */
export function effectiveOdds(
  config: GameConfig,
  rewards: RewardRef[],
): Array<{ rewardId: string | null; label: string; emoji: string; percent: number }> {
  const known = new Map(rewards.map((r) => [r.id, r]));
  const disponibles = config.prizes.filter((p) => {
    const r = known.get(p.rewardId);
    if (!r || r.active === false) return false;
    if (p.stock !== null && p.wonCount >= p.stock) return false;
    return p.probability > 0;
  });

  const total = disponibles.reduce((s, p) => s + p.probability, 0) + Math.max(0, config.loseProbability);
  if (total <= 0) return [{ rewardId: null, label: "Perdu", emoji: "🙈", percent: 100 }];

  type Ligne = { rewardId: string | null; label: string; emoji: string; percent: number };
  const lignes: Ligne[] = disponibles.map((p) => {
    const r = known.get(p.rewardId)!;
    return {
      rewardId: p.rewardId,
      label: r.name,
      emoji: r.emoji || "🎁",
      percent: Math.round((p.probability / total) * 1000) / 10,
    };
  });

  const perdu = Math.round((Math.max(0, config.loseProbability) / total) * 1000) / 10;
  if (perdu > 0) lignes.push({ rewardId: null, label: "Perdu", emoji: "🙈", percent: perdu });
  return lignes;
}
