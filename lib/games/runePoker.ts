import type {
  Sigil,
  HandRank,
  GameSession,
  RunePokerConfig,
  RunePokerState,
} from "@/types/game";

// ─── Constants ───

export const SIGILS: Sigil[] = ["flame", "void", "storm", "earth", "star", "crown"];

const HAND_RANK_ORDER: HandRank[] = [
  "nothing",
  "one-pair",
  "two-pair",
  "three-of-a-kind",
  "full-house",
  "four-of-a-kind",
  "straight",
  "five-of-a-kind",
];

// ─── Pure helpers ───

export function rollCoins(count: number): Sigil[] {
  return Array.from({ length: count }, () => SIGILS[Math.floor(Math.random() * SIGILS.length)]);
}

function countSigils(coins: Sigil[]): Map<Sigil, number> {
  const counts = new Map<Sigil, number>();
  for (const s of coins) counts.set(s, (counts.get(s) ?? 0) + 1);
  return counts;
}

export function evaluateHand(coins: Sigil[]): HandRank {
  const counts = countSigils(coins);
  const freq = Array.from(counts.values()).sort((a, b) => b - a);

  // Five of a kind
  if (freq[0] === 5) return "five-of-a-kind";

  // Straight: 5 sequential sigils
  if (counts.size === 5) {
    const indices = coins.map((s) => SIGILS.indexOf(s)).sort((a, b) => a - b);
    // Two valid straights: 0-1-2-3-4 or 1-2-3-4-5
    if (indices[4] - indices[0] === 4) return "straight";
  }

  if (freq[0] === 4) return "four-of-a-kind";
  if (freq[0] === 3 && freq[1] === 2) return "full-house";
  if (freq[0] === 3) return "three-of-a-kind";
  if (freq[0] === 2 && freq[1] === 2) return "two-pair";
  if (freq[0] === 2) return "one-pair";

  return "nothing";
}

export function compareHands(a: HandRank, b: HandRank): number {
  return HAND_RANK_ORDER.indexOf(a) - HAND_RANK_ORDER.indexOf(b);
}

export function handLabel(rank: HandRank): string {
  switch (rank) {
    case "nothing": return "Nothing";
    case "one-pair": return "One Pair";
    case "two-pair": return "Two Pair";
    case "three-of-a-kind": return "Three of a Kind";
    case "full-house": return "Full House";
    case "four-of-a-kind": return "Four of a Kind";
    case "straight": return "Straight";
    case "five-of-a-kind": return "Five of a Kind";
  }
}

// ─── AI strategy ───

function computeAiKeeps(coins: Sigil[], challengeRate: 1 | 2 | 3): boolean[] {
  const locks = [false, false, false, false, false];

  if (challengeRate === 1) {
    // Easy: randomly lock ~2 coins
    for (let i = 0; i < 5; i++) {
      locks[i] = Math.random() < 0.4;
    }
    return locks;
  }

  // Normal + Hard: count sigils, keep best groups
  const counts = countSigils(coins);

  if (challengeRate === 3) {
    // Hard: keep anything that's part of a pair or better
    for (let i = 0; i < 5; i++) {
      if ((counts.get(coins[i]) ?? 0) >= 2) locks[i] = true;
    }
    // If keeping 4+ (four-of-a-kind or better), keep all of them
    // If keeping nothing, keep the highest-indexed sigil
    if (locks.every((l) => !l)) {
      let bestIdx = 0;
      let bestRank = -1;
      for (let i = 0; i < 5; i++) {
        const rank = SIGILS.indexOf(coins[i]);
        if (rank > bestRank) {
          bestRank = rank;
          bestIdx = i;
        }
      }
      locks[bestIdx] = true;
    }
    return locks;
  }

  // Normal (rate 2): basic strategy
  // Keep pairs or better
  for (let i = 0; i < 5; i++) {
    if ((counts.get(coins[i]) ?? 0) >= 2) locks[i] = true;
  }
  // If nothing matched, keep highest single
  if (locks.every((l) => !l)) {
    let bestIdx = 0;
    let bestRank = -1;
    for (let i = 0; i < 5; i++) {
      const rank = SIGILS.indexOf(coins[i]);
      if (rank > bestRank) {
        bestRank = rank;
        bestIdx = i;
      }
    }
    locks[bestIdx] = true;
  }
  return locks;
}

function aiRecast(coins: Sigil[], challengeRate: 1 | 2 | 3): { coins: Sigil[]; locks: boolean[] } {
  const locks = computeAiKeeps(coins, challengeRate);
  const newCoins = coins.map((c, i) => (locks[i] ? c : SIGILS[Math.floor(Math.random() * SIGILS.length)]));
  return { coins: newCoins, locks };
}

// ─── Defaults ───

export function getDefaultConfig(): RunePokerConfig {
  return {
    challengeRate: 2,
    roundCount: 3,
    opponentEntityId: null,
  };
}

export function getDefaultState(): RunePokerState {
  return {
    round: 1,
    playerWins: 0,
    opponentWins: 0,
    phase: "casting",
    castsRemaining: 2,
    playerCoins: [],
    opponentCoins: [],
    lockedCoins: [false, false, false, false, false],
    opponentLockedCoins: [false, false, false, false, false],
    playerHand: null,
    opponentHand: null,
  };
}

// ─── Showdown logic ───

function resolveShowdown(state: RunePokerState, config: RunePokerConfig): {
  state: RunePokerState;
  winner: string | null;
} {
  const playerHand = evaluateHand(state.playerCoins);
  const opponentHand = evaluateHand(state.opponentCoins);
  const cmp = compareHands(playerHand, opponentHand);

  let playerWins = state.playerWins;
  let opponentWins = state.opponentWins;
  if (cmp > 0) playerWins++;
  else if (cmp < 0) opponentWins++;
  // tie: neither increments

  const winsNeeded = Math.ceil(config.roundCount / 2);
  let winner: string | null = null;
  let phase: RunePokerState["phase"] = "showdown";

  if (playerWins >= winsNeeded) {
    winner = "player";
  } else if (opponentWins >= winsNeeded) {
    winner = "opponent";
  } else if (state.round >= config.roundCount) {
    // All rounds played
    if (playerWins > opponentWins) winner = "player";
    else if (opponentWins > playerWins) winner = "opponent";
    else winner = "draw";
  } else {
    phase = "round-end";
  }

  return {
    state: {
      ...state,
      phase,
      playerHand,
      opponentHand,
      playerWins,
      opponentWins,
    },
    winner,
  };
}

// ─── Move handler ───

export function handleRunePokerMove(
  session: GameSession,
  body: { action?: string; lockedCoins?: boolean[] }
): { state: RunePokerState; winner: string | null; error?: string } {
  const state = session.state as RunePokerState;
  const config = session.config as RunePokerConfig;
  const { action } = body;

  // ── Cast: initial roll or start next round ──
  if (action === "cast") {
    if (state.phase !== "casting" && state.phase !== "round-end") {
      return { state, winner: null, error: "Cannot cast now" };
    }

    const round = state.phase === "round-end" ? state.round + 1 : state.round;
    const playerCoins = rollCoins(5);
    const opponentCoins = rollCoins(5);

    return {
      state: {
        ...state,
        round,
        phase: "keeping",
        castsRemaining: 2,
        playerCoins,
        opponentCoins,
        lockedCoins: [false, false, false, false, false],
        opponentLockedCoins: [false, false, false, false, false],
        playerHand: null,
        opponentHand: null,
      },
      winner: null,
    };
  }

  // ── Recast: roll unlocked coins ──
  if (action === "recast") {
    if (state.phase !== "keeping") {
      return { state, winner: null, error: "Cannot recast now" };
    }
    if (state.castsRemaining <= 0) {
      return { state, winner: null, error: "No recasts remaining" };
    }

    const locks = body.lockedCoins ?? state.lockedCoins;
    if (!Array.isArray(locks) || locks.length !== 5) {
      return { state, winner: null, error: "lockedCoins must be a boolean[5]" };
    }

    // If all coins are locked, treat as end-turn (no point recasting)
    if (locks.every((l) => l)) {
      return resolveShowdown(
        { ...state, lockedCoins: locks, castsRemaining: 0 },
        config
      );
    }

    // Recast unlocked player coins
    const playerCoins = state.playerCoins.map((c, i) =>
      locks[i] ? c : SIGILS[Math.floor(Math.random() * SIGILS.length)]
    );

    // AI recasts
    const aiResult = aiRecast(state.opponentCoins, config.challengeRate);

    const castsRemaining = state.castsRemaining - 1;

    // If no recasts left, go to showdown
    if (castsRemaining <= 0) {
      return resolveShowdown(
        { ...state, playerCoins, opponentCoins: aiResult.coins, opponentLockedCoins: aiResult.locks, lockedCoins: locks, castsRemaining: 0 },
        config
      );
    }

    return {
      state: {
        ...state,
        playerCoins,
        opponentCoins: aiResult.coins,
        opponentLockedCoins: aiResult.locks,
        lockedCoins: locks,
        castsRemaining,
      },
      winner: null,
    };
  }

  // ── Set locks: sync player's keep selections so observers see them live ──
  if (action === "set-locks") {
    if (state.phase !== "keeping") {
      return { state, winner: null, error: "Cannot set locks now" };
    }
    const locks = body.lockedCoins;
    if (
      !Array.isArray(locks) ||
      locks.length !== 5 ||
      !locks.every((l) => typeof l === "boolean")
    ) {
      return { state, winner: null, error: "lockedCoins must be a boolean[5]" };
    }
    return {
      state: { ...state, lockedCoins: locks },
      winner: null,
    };
  }

  // ── End turn: skip remaining recasts, go to showdown ──
  if (action === "end-turn") {
    if (state.phase !== "keeping") {
      return { state, winner: null, error: "Cannot end turn now" };
    }

    const locks = body.lockedCoins ?? state.lockedCoins;

    return resolveShowdown(
      { ...state, lockedCoins: locks, castsRemaining: 0 },
      config
    );
  }

  return { state, winner: null, error: "Unknown action" };
}
