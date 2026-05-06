// Thin re-export so the registry contract (which imports from lib/games/<id>)
// stays consistent with all other game modules. Actual logic lives in
// lib/combat/spaceCombat.ts to keep combat-specific code grouped.
export {
  getDefaultConfig,
  getDefaultState,
} from "@/lib/combat/spaceCombat";
