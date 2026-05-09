export interface CombatFactionDef {
  id: string;
  displayName: string;
  color: string;          // hex
}

// Combat-specific factions. Decoupled from lib/allegiances.ts so the GM has
// narrative freedom for combat encounters. Edit this list to add/rename/recolor.
export const COMBAT_FACTIONS: readonly CombatFactionDef[] = [
  { id: "imperial", displayName: "Imperial", color: "#7c3aed" },
  { id: "pirate",   displayName: "Pirate",   color: "#dc2626" },
  { id: "rebel",    displayName: "Rebel",    color: "#f59e0b" },
  { id: "civilian", displayName: "Civilian", color: "#94a3b8" },
] as const;

export const DEFAULT_NO_FACTION_COLOR = "#ffffff";

export function resolveFactionColor(factionId: string | null): string {
  if (!factionId) return DEFAULT_NO_FACTION_COLOR;
  const f = COMBAT_FACTIONS.find((x) => x.id === factionId);
  return f?.color ?? DEFAULT_NO_FACTION_COLOR;
}

export function resolveFactionName(factionId: string | null): string {
  if (!factionId) return "—";
  const f = COMBAT_FACTIONS.find((x) => x.id === factionId);
  return f?.displayName ?? "—";
}
