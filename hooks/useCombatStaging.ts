"use client";

import { useState } from "react";
import type { CombatEnemyShip } from "@/types/game";

// GM's client-side staging buffer for combat. The "original" snapshot is taken
// at the start of each GM phase (and refreshed only when the phase resets);
// "staged" is freely mutable until End Turn commits the full list to the server.
//
// Per spec:
//  - Adds → into staging only (committed at End Turn)
//  - Moves / label / faction / range / facing → into staging only
//  - Deletes → bypass staging, fire DELETE immediately (and prune both buffers)
//  - End Turn → server replaces enemies with the staged list
//  - Esc on an active edit → revert that ship's staged values to original
export interface StagingState {
  originalEnemies: CombatEnemyShip[];
  stagedEnemies: CombatEnemyShip[];
}

export interface StagingActions {
  // Apply changes to a staged ship.
  editStaged(id: string, changes: Partial<CombatEnemyShip>): void;
  // Add a new ship to the staged list (id should be a uuid).
  addStaged(enemy: CombatEnemyShip): void;
  // Remove a ship from both buffers (used after a hard server delete).
  removeFromStaging(id: string): void;
  // Revert one ship's staged values back to original. If the ship was a
  // staged-only add (not in original), it's removed entirely from staging.
  revertStaged(id: string): void;
  // Replace original snapshot with the polled list. Called when phase resets
  // (gm turn starts) or on any moveCount that the staging hook can't recover.
  resyncOriginal(next: CombatEnemyShip[]): void;
}

export function useCombatStaging(initial: CombatEnemyShip[]): StagingState & StagingActions {
  const [originalEnemies, setOriginalEnemies] = useState<CombatEnemyShip[]>(initial);
  const [stagedEnemies, setStagedEnemies] = useState<CombatEnemyShip[]>(initial);

  return {
    originalEnemies,
    stagedEnemies,
    editStaged(id, changes) {
      setStagedEnemies((cur) =>
        cur.map((e) => (e.id === id ? { ...e, ...changes } : e)),
      );
    },
    addStaged(enemy) {
      setStagedEnemies((cur) => [...cur, enemy]);
    },
    removeFromStaging(id) {
      setStagedEnemies((cur) => cur.filter((e) => e.id !== id));
      setOriginalEnemies((cur) => cur.filter((e) => e.id !== id));
    },
    revertStaged(id) {
      const originalShip = originalEnemies.find((e) => e.id === id);
      setStagedEnemies((cur) => {
        if (!originalShip) {
          // Was a staged-only add — drop it.
          return cur.filter((e) => e.id !== id);
        }
        return cur.map((e) => (e.id === id ? originalShip : e));
      });
    },
    resyncOriginal(next) {
      setOriginalEnemies(next);
      setStagedEnemies(next);
    },
  };
}
