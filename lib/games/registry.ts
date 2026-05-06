import type { GameType, GameConfig, GameState } from "@/types/game";

export interface VictoryText {
  playerWin: string;
  playerLose: string;
  spectatorWin: string;
  spectatorLose: string;
  draw: string;
}

export interface GameDefinition {
  label: string;
  getDefaultConfig: () => GameConfig;
  getDefaultState: () => GameState;
  victoryText: VictoryText;
}

// ─── Register games here ───

import { getDefaultBoard } from "./stormQueensFolly";
import { getDefaultConfig as ecDefaultConfig, getDefaultState as ecDefaultState } from "./engineeringChallenge";
import { getDefaultConfig as rpDefaultConfig, getDefaultState as rpDefaultState } from "./runePoker";
import { getDefaultConfig as acDefaultConfig, getDefaultState as acDefaultState } from "./arcaneCard";
import {
  getDefaultConfig as ipDefaultConfig,
  getDefaultState as ipDefaultState,
} from "./isolationProtocol";
import {
  getDefaultConfig as scDefaultConfig,
  getDefaultState as scDefaultState,
} from "./spaceCombat";

export const GAME_REGISTRY: Record<GameType, GameDefinition> = {
  "storm-queens-folly": {
    label: "Storm Queen's Folly",
    getDefaultConfig: () => ({
      challengeRate: 2 as const,
      initialBoard: getDefaultBoard(),
      opponentEntityId: null,
    }),
    getDefaultState: () => ({
      board: getDefaultBoard(),
      turn: "player" as const,
      moveHistory: [],
    }),
    victoryText: {
      playerWin: "The Storm Queen's seal has been broken.",
      playerLose: "The Storm Queen's seal remains unbroken.",
      spectatorWin: "The challenger has triumphed.",
      spectatorLose: "The Storm Queen's seal remains unbroken.",
      draw: "Neither side prevails.",
    },
  },
  "engineering-challenge": {
    label: "Engineering Challenge",
    getDefaultConfig: () => ecDefaultConfig(4),
    getDefaultState: ecDefaultState,
    victoryText: {
      playerWin: "Power conduits restored.",
      playerLose: "System failure — conduits incomplete.",
      spectatorWin: "The engineer has succeeded.",
      spectatorLose: "The system remains offline.",
      draw: "Time expired.",
    },
  },
  "rune-poker": {
    label: "Rune Poker",
    getDefaultConfig: rpDefaultConfig,
    getDefaultState: rpDefaultState,
    victoryText: {
      playerWin: "The runes have spoken in your favor.",
      playerLose: "The runes turn against you.",
      spectatorWin: "The challenger reads the runes true.",
      spectatorLose: "The runes deny the challenger.",
      draw: "The runes are silent.",
    },
  },
  "arcane-card": {
    label: "Arcane Card",
    getDefaultConfig: acDefaultConfig,
    getDefaultState: acDefaultState,
    victoryText: {
      playerWin: "The deck bows to your hand.",
      playerLose: "The arcane favors another.",
      spectatorWin: "The challenger claims the hand.",
      spectatorLose: "The hand is lost.",
      draw: "The cards fall silent.",
    },
  },
  "isolation-protocol": {
    label: "Isolation Protocol",
    getDefaultConfig: ipDefaultConfig,
    getDefaultState: () => ipDefaultState(),
    victoryText: {
      playerWin: "The quarry is cornered.",
      playerLose: "The quarry has slipped the cordon.",
      spectatorWin: "The cordon holds.",
      spectatorLose: "The cordon has broken.",
      draw: "The hunt is inconclusive.",
    },
  },
  "space-combat": {
    label: "Space Combat",
    getDefaultConfig: scDefaultConfig,
    getDefaultState: scDefaultState,
    victoryText: {
      playerWin: "—",
      playerLose: "—",
      spectatorWin: "—",
      spectatorLose: "—",
      draw: "—",
    },
  },
};

export const GAME_TYPES = Object.keys(GAME_REGISTRY) as GameType[];
