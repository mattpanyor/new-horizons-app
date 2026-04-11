import type {
  GameSession,
  ArcaneCardConfig,
  ArcaneCardState,
  ArcaneCardPlayerState,
  SideCard,
  PlayedCard,
} from "@/types/game";

// ─── Constants ───

const HAND_SIZE = 4;
const AUTO_STAND_TOTAL = 20;
const AUTO_STAND_CARDS = 9;
const BUST_TOTAL = 20;

// ─── Deck builders ───

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildMainDeck(): number[] {
  const deck: number[] = [];
  for (let v = 1; v <= 10; v++) {
    for (let k = 0; k < 4; k++) deck.push(v);
  }
  return shuffle(deck);
}

// 12-card mirrored side deck: one each of +1..+6 and -1..-6
function buildSideDeck(idPrefix: string): SideCard[] {
  const deck: SideCard[] = [];
  let idx = 0;
  for (let v = 1; v <= 6; v++) {
    deck.push({ id: `${idPrefix}${idx++}`, kind: "positive", value: v });
  }
  for (let v = 1; v <= 6; v++) {
    deck.push({ id: `${idPrefix}${idx++}`, kind: "negative", value: v });
  }
  return shuffle(deck);
}

function negativeMinimumForRate(rate: 1 | 2 | 3): number {
  if (rate === 1) return 2;
  if (rate === 2) return 1;
  return 0;
}

// Deal a 4-card hand with a guaranteed minimum number of negatives.
// Walks the already-shuffled deck to pick the first N negatives as guaranteed,
// then fills the remaining slots randomly from the rest of the deck.
function dealHand(deck: SideCard[], negMin: number): SideCard[] {
  if (negMin <= 0) {
    return deck.slice(0, HAND_SIZE);
  }
  const negatives: SideCard[] = [];
  const rest: SideCard[] = [];
  for (const c of deck) {
    if (c.kind === "negative" && negatives.length < negMin) {
      negatives.push(c);
    } else {
      rest.push(c);
    }
  }
  // Shuffle rest so the filler slots are random (the extra negatives beyond the
  // guaranteed count still have an equal chance of being drawn)
  const shuffledRest = shuffle(rest);
  const filler = shuffledRest.slice(0, HAND_SIZE - negatives.length);
  return shuffle([...negatives, ...filler]);
}

function newPlayerState(sideIdPrefix: string, negMin: number): ArcaneCardPlayerState {
  const mainDeck = buildMainDeck();
  const sideDeck = buildSideDeck(sideIdPrefix);
  const hand = dealHand(sideDeck, negMin);
  // Auto-deal one opening main card into played (this is the turn 1 start-of-turn card)
  const opening = mainDeck.shift() as number;
  return {
    mainDeck,
    hand,
    played: [{ kind: "main", value: opening }],
    standing: false,
  };
}

// ─── Totals ───

export function totalOf(played: PlayedCard[]): number {
  let t = 0;
  for (const p of played) {
    if (p.kind === "main") t += p.value;
    else if (p.playedAs === "positive") t += p.card.value;
    else t -= p.card.value;
  }
  return t;
}

function cardCount(player: ArcaneCardPlayerState): number {
  return player.played.length;
}

function shouldAutoStand(player: ArcaneCardPlayerState): boolean {
  return totalOf(player.played) >= AUTO_STAND_TOTAL || cardCount(player) >= AUTO_STAND_CARDS;
}

function isBust(player: ArcaneCardPlayerState): boolean {
  return totalOf(player.played) > BUST_TOTAL;
}

// ─── Defaults (for registry) ───

export function getDefaultConfig(): ArcaneCardConfig {
  return {
    challengeRate: 2,
    opponentEntityId: null,
  };
}

export function getDefaultState(challengeRate: 1 | 2 | 3 = 2): ArcaneCardState {
  const negMin = negativeMinimumForRate(challengeRate);
  return {
    player: newPlayerState("p", negMin),
    opponent: newPlayerState("o", negMin),
    turn: "player",
    moveCount: 0,
  };
}

// ─── Sanitization (strips opponent private info for client) ───

export function sanitizeStateForClient(state: ArcaneCardState): ArcaneCardState {
  return {
    ...state,
    opponent: {
      ...state.opponent,
      // Hide deck order and hand identities — the client only needs counts
      mainDeck: new Array(state.opponent.mainDeck.length).fill(0),
      hand: state.opponent.hand.map((c) => ({
        id: c.id,
        kind: "positive",
        value: 0,
      })),
    },
  };
}

// ─── Move handling ───

interface ArcaneCardMoveBody {
  moveVersion?: number;
  playSide?: { cardId: string; playAs: "positive" | "negative" };
  terminal?: "end-turn" | "hold";
}

function legalSignFor(card: SideCard, playAs: "positive" | "negative"): boolean {
  if (card.kind === "positive") return playAs === "positive";
  if (card.kind === "negative") return playAs === "negative";
  return true;
}

function drawMainCard(player: ArcaneCardPlayerState): ArcaneCardPlayerState {
  if (player.mainDeck.length === 0) return player;
  const [top, ...rest] = player.mainDeck;
  return {
    ...player,
    mainDeck: rest,
    played: [...player.played, { kind: "main", value: top }],
  };
}

function playSideCard(
  player: ArcaneCardPlayerState,
  cardId: string,
  playAs: "positive" | "negative"
): { next: ArcaneCardPlayerState; error?: string } {
  const idx = player.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return { next: player, error: "Card not in hand" };
  const card = player.hand[idx];
  if (!legalSignFor(card, playAs)) return { next: player, error: "Illegal sign for this card" };
  const newHand = [...player.hand.slice(0, idx), ...player.hand.slice(idx + 1)];
  return {
    next: {
      ...player,
      hand: newHand,
      played: [...player.played, { kind: "side", card, playedAs: playAs }],
    },
  };
}

// Apply a player's action for the turn they're already in. NO draw happens here —
// the turn-start draw was already applied at the end of the previous handler call
// (or at game start for turn 1 via the opening card).
function applyPlayerAction(
  player: ArcaneCardPlayerState,
  playSide: ArcaneCardMoveBody["playSide"] | undefined,
  terminal: "end-turn" | "hold"
): { next: ArcaneCardPlayerState; error?: string } {
  let next = player;

  if (playSide) {
    const res = playSideCard(next, playSide.cardId, playSide.playAs);
    if (res.error) return { next: player, error: res.error };
    next = res.next;
  }

  const bust = isBust(next);
  const forceStand = bust || terminal === "hold" || shouldAutoStand(next);

  next = { ...next, standing: forceStand };
  return { next };
}

// ─── Winner resolution ───

function resolveWinner(state: ArcaneCardState): "player" | "opponent" | "draw" | null {
  if (!state.player.standing || !state.opponent.standing) return null;
  const pT = totalOf(state.player.played);
  const oT = totalOf(state.opponent.played);
  const pBust = pT > BUST_TOTAL;
  const oBust = oT > BUST_TOTAL;
  if (pBust && oBust) return "draw";
  if (pBust) return "opponent";
  if (oBust) return "player";
  // Closer to 20 wins
  const pDist = AUTO_STAND_TOTAL - pT;
  const oDist = AUTO_STAND_TOTAL - oT;
  if (pDist < oDist) return "player";
  if (oDist < pDist) return "opponent";
  return "draw";
}

// ─── AI ───

// Enumerate all legal (optional side play + terminal) decisions for a player's current state.
// The draw has already been applied when this is called.
interface AiDecision {
  playSide?: { cardId: string; playAs: "positive" | "negative" };
  terminal: "end-turn" | "hold";
}

function enumerateLegalPlays(player: ArcaneCardPlayerState): AiDecision[] {
  const decisions: AiDecision[] = [
    { terminal: "end-turn" },
    { terminal: "hold" },
  ];
  for (const card of player.hand) {
    if (card.kind === "positive" || card.kind === "mixed") {
      decisions.push({ playSide: { cardId: card.id, playAs: "positive" }, terminal: "end-turn" });
      decisions.push({ playSide: { cardId: card.id, playAs: "positive" }, terminal: "hold" });
    }
    if (card.kind === "negative" || card.kind === "mixed") {
      decisions.push({ playSide: { cardId: card.id, playAs: "negative" }, terminal: "end-turn" });
      decisions.push({ playSide: { cardId: card.id, playAs: "negative" }, terminal: "hold" });
    }
  }
  return decisions;
}

// Simulate applying a decision to a player's post-draw state and return the resulting played cards.
function simulateDecision(player: ArcaneCardPlayerState, decision: AiDecision): PlayedCard[] {
  if (!decision.playSide) return player.played;
  const { cardId, playAs } = decision.playSide;
  const card = player.hand.find((c) => c.id === cardId);
  if (!card) return player.played;
  return [...player.played, { kind: "side", card, playedAs: playAs }];
}

function expectedDrawValue(deck: number[]): number {
  if (deck.length === 0) return 0;
  return deck.reduce((a, b) => a + b, 0) / deck.length;
}

function bustProbability(currentTotal: number, deck: number[]): number {
  if (deck.length === 0) return 0;
  const busting = deck.filter((v) => currentTotal + v > BUST_TOTAL).length;
  return busting / deck.length;
}

// AI entry point. `player` is the opponent's state AFTER their turn-start draw.
function decideAiMove(
  player: ArcaneCardPlayerState,
  opponent: ArcaneCardPlayerState,
  rate: 1 | 2 | 3
): AiDecision {
  const decisions = enumerateLegalPlays(player);
  const opponentLocked = opponent.standing;
  const opponentTotal = totalOf(opponent.played);
  const opponentBust = opponentTotal > BUST_TOTAL;

  const scoreDecision = (d: AiDecision): number => {
    const resulting = simulateDecision(player, d);
    const total = totalOf(resulting);

    // Hard penalty for busting
    if (total > BUST_TOTAL) return -1000 - (total - BUST_TOTAL);

    // If opponent already lost (busted), just hold at any legal total
    if (opponentLocked && opponentBust) {
      return d.terminal === "hold" ? 500 : -500;
    }

    // If opponent is locked at a known total, aim to beat it
    if (opponentLocked) {
      if (d.terminal === "hold") {
        if (total > opponentTotal) return 800 + total; // winning hold
        if (total === opponentTotal) return 200 + total; // tie hold
        return -200 + total; // losing hold (still better than busting)
      }
      // end-turn: keep drawing. Value based on expected total after next draw
      // and bust probability.
      const eNext = expectedDrawValue(player.mainDeck);
      const pBust = bustProbability(total, player.mainDeck);
      const expectedFinal = total + eNext;
      const bustPenalty = rate === 1 ? 300 : rate === 2 ? 600 : 900;
      return expectedFinal * 10 - pBust * bustPenalty + (total > opponentTotal ? 50 : 0);
    }

    // Opponent still playing. Balance expected final total against bust risk.
    if (d.terminal === "hold") {
      // Reward holding at strong totals
      if (total >= 18) return 500 + total * 5;
      if (total >= 17 && rate === 1) return 400 + total * 5;
      if (total >= 19 && rate === 3) return 550 + total * 5;
      return total * 3; // weak hold, probably not picked
    }

    // end-turn: keep drawing
    const eNext = expectedDrawValue(player.mainDeck);
    const pBust = bustProbability(total, player.mainDeck);
    const expectedFinal = total + eNext;
    const bustPenalty = rate === 1 ? 250 : rate === 2 ? 500 : 800;
    return expectedFinal * 10 - pBust * bustPenalty;
  };

  let best = decisions[0];
  let bestScore = -Infinity;
  for (const d of decisions) {
    const s = scoreDecision(d);
    if (s > bestScore) {
      bestScore = s;
      best = d;
    }
  }
  return best;
}

// ─── Move handler ───

export function handleArcaneCardMove(
  session: GameSession,
  body: ArcaneCardMoveBody
): { state: ArcaneCardState; winner: string | null; error?: string } {
  const state = session.state as ArcaneCardState;
  const config = session.config as ArcaneCardConfig;
  const { moveVersion, playSide, terminal } = body;

  if (typeof moveVersion === "number" && moveVersion !== state.moveCount) {
    return { state, winner: null, error: "Stale move — game has advanced" };
  }
  if (state.turn !== "player") {
    return { state, winner: null, error: "Not your turn" };
  }
  if (state.player.standing) {
    return { state, winner: null, error: "You have already held" };
  }
  if (terminal !== "end-turn" && terminal !== "hold") {
    return { state, winner: null, error: "terminal must be 'end-turn' or 'hold'" };
  }

  // Apply player's action (no draw — their turn-start card was already drawn
  // at the previous turn transition, or is the opening card on turn 1)
  const playerResult = applyPlayerAction(state.player, playSide, terminal);
  if (playerResult.error) {
    return { state, winner: null, error: playerResult.error };
  }

  let nextState: ArcaneCardState = {
    ...state,
    player: playerResult.next,
    turn: "opponent",
    moveCount: state.moveCount + 1,
  };

  let winner = resolveWinner(nextState);

  // Loop AI turns while the opponent is still active. This can run zero times
  // (opponent already standing before the loop) or many times (opponent taking
  // solo turns after the player held).
  //
  // Draw timing: the AI's current turn-start card was already drawn at the end of
  // the previous handler call (or is the opening card on turn 1). On the FIRST
  // iteration of this loop we do not draw. On any subsequent iteration (the player
  // has held and the AI is taking solo turns), we draw at the start of each
  // additional AI turn to advance the AI through multiple turns in one POST.
  let aiTurnsThisHandler = 0;
  while (!winner && !nextState.opponent.standing) {
    let opponentAfter = nextState.opponent;

    if (aiTurnsThisHandler > 0) {
      opponentAfter = drawMainCard(opponentAfter);
    }
    aiTurnsThisHandler++;

    // Ask AI for decision — even if the post-draw total is over 20, because
    // a negative side card can pull the total back down below the bust line.
    const decision = decideAiMove(opponentAfter, nextState.player, config.challengeRate);

    if (decision.playSide) {
      const res = playSideCard(opponentAfter, decision.playSide.cardId, decision.playSide.playAs);
      if (!res.error) opponentAfter = res.next;
    }

    const standing =
      isBust(opponentAfter) || decision.terminal === "hold" || shouldAutoStand(opponentAfter);

    nextState = {
      ...nextState,
      opponent: { ...opponentAfter, standing },
      moveCount: nextState.moveCount + 1,
    };

    winner = resolveWinner(nextState);
    if (winner) break;

    // If the player is still active, stop looping — control goes back to them below
    if (!nextState.player.standing) break;

    // Player is standing but opponent isn't — opponent takes another solo turn
  }

  // End-of-handler: draw next turn-start cards for BOTH players simultaneously
  // (if still active and game isn't over). This keeps the visual state symmetric —
  // the player and the AI both gain their next card at the same moment in the UI.
  // Even if a draw busts someone, we don't auto-stand: they may have a negative
  // side card that can pull the total back under 20 on their next action.
  if (!winner) {
    let playerNext = nextState.player;
    let opponentNext = nextState.opponent;
    if (!playerNext.standing) {
      playerNext = drawMainCard(playerNext);
    }
    if (!opponentNext.standing) {
      opponentNext = drawMainCard(opponentNext);
    }
    nextState = {
      ...nextState,
      player: playerNext,
      opponent: opponentNext,
      turn: "player",
      moveCount: nextState.moveCount + 1,
    };
  }

  return { state: nextState, winner };
}
