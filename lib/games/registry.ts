import type { GameType, Board } from "@/types/game";

export interface VictoryText {
  playerWin: string;
  playerLose: string;
  spectatorWin: string;
  spectatorLose: string;
  draw: string;
}

export interface GameDefinition {
  label: string;
  getDefaultBoard: () => Board;
  victoryText: VictoryText;
}

// ─── Register games here ───

import { getDefaultBoard as sqfDefaultBoard } from "./stormQueensFolly";

export const GAME_REGISTRY: Record<GameType, GameDefinition> = {
  "storm-queens-folly": {
    label: "Storm Queen's Folly",
    getDefaultBoard: sqfDefaultBoard,
    victoryText: {
      playerWin: "The Storm Queen's seal has been broken.",
      playerLose: "The Storm Queen's seal remains unbroken.",
      spectatorWin: "The challenger has triumphed.",
      spectatorLose: "The Storm Queen's seal remains unbroken.",
      draw: "Neither side prevails.",
    },
  },
};

export const GAME_TYPES = Object.keys(GAME_REGISTRY) as GameType[];
