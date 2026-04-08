import type { ComponentType } from "react";
import type { GameType, ActiveGameResponse } from "@/types/game";
import type { VictoryText } from "@/lib/games/registry";
import StormQueensFollyBoard from "./StormQueensFollyBoard";

export interface GameBoardProps {
  session: ActiveGameResponse["session"];
  player: ActiveGameResponse["player"];
  opponent: ActiveGameResponse["opponent"];
  isDesignatedPlayer: boolean;
  isMyTurn: boolean;
  username: string;
  victoryText: VictoryText;
}

// ─── Register game board components here ───

export const GAME_COMPONENTS: Record<GameType, ComponentType<GameBoardProps>> = {
  "storm-queens-folly": StormQueensFollyBoard,
};
