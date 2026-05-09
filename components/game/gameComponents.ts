import type { ComponentType } from "react";
import type { GameType, ActiveGameResponse } from "@/types/game";
import type { VictoryText } from "@/lib/games/registry";
import StormQueensFollyBoard from "./StormQueensFollyBoard";
import EngineeringChallengeBoard from "./EngineeringChallengeBoard";
import RunePokerBoard from "./RunePokerBoard";
import ArcaneCardBoard from "./ArcaneCardBoard";
import IsolationProtocolBoard from "./IsolationProtocolBoard";
import SpaceCombatBoard from "./SpaceCombatBoard";

export interface GameBoardProps {
  session: ActiveGameResponse["session"];
  player: ActiveGameResponse["player"];
  opponent: ActiveGameResponse["opponent"];
  viewer: ActiveGameResponse["viewer"];
  isDesignatedPlayer: boolean;
  isMyTurn: boolean;
  username: string;
  victoryText: VictoryText;
}

// ─── Register game board components here ───

export const GAME_COMPONENTS: Record<GameType, ComponentType<GameBoardProps>> = {
  "storm-queens-folly": StormQueensFollyBoard,
  "engineering-challenge": EngineeringChallengeBoard,
  "rune-poker": RunePokerBoard,
  "arcane-card": ArcaneCardBoard,
  "isolation-protocol": IsolationProtocolBoard,
  "space-combat": SpaceCombatBoard,
};
