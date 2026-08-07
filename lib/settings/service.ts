// App settings policy.
//
// Following the rule in CLAUDE.md: validation lives here, not in the route
// handler, so the admin panel and any future surface (MCP, a script, a seed)
// all get the same rules. Routes are thin adapters over these functions.

import { getSetting, getSettingRow, setSetting, type AppSetting } from "@/lib/db/settings";
import { DEFAULT_PRESET, PLANET_PRESETS, type PlanetPresetName } from "@/lib/planetPresets";

export const HOME_SCREEN_ART = "home_screen_art";

/**
 * Local override for the home screen art, honoured **in development only**.
 *
 * Set `HOME_SCREEN_ART=verdant` in `.env.local` to force a theme while working
 * on it, without touching the database or disturbing whatever the admin has
 * chosen. Ignored in production on purpose: a stray environment variable
 * silently outranking the admin's setting — and being invisible from the admin
 * panel, which would still show the stored value — is a bad failure to debug.
 */
function devOverride(): PlanetPresetName | null {
  if (process.env.NODE_ENV === "production") return null;
  const raw = process.env.HOME_SCREEN_ART?.trim();
  if (!raw) return null;
  if (!isPlanetPreset(raw)) {
    console.warn(
      `HOME_SCREEN_ART="${raw}" is not a known preset; ignoring. Options: ${presetOptions()
        .map((o) => o.value)
        .join(", ")}`,
    );
    return null;
  }
  return raw;
}

export function isPlanetPreset(value: string): value is PlanetPresetName {
  return Object.prototype.hasOwnProperty.call(PLANET_PRESETS, value);
}

/** Every theme an admin may choose, for the dropdown. */
export function presetOptions(): { value: PlanetPresetName; label: string }[] {
  return (Object.keys(PLANET_PRESETS) as PlanetPresetName[]).map((value) => ({
    value,
    label: PLANET_PRESETS[value].label,
  }));
}

/**
 * Which theme to render. Never throws and never returns something invalid:
 * an unreachable database, an empty table, or a stored key that no longer
 * exists in PLANET_PRESETS all fall back to the default. A theme deleted from
 * the code must not be able to break the login page.
 */
export async function getHomeScreenArt(): Promise<PlanetPresetName> {
  const override = devOverride();
  if (override) return override;

  const stored = await getSetting(HOME_SCREEN_ART);
  if (stored && isPlanetPreset(stored)) return stored;
  if (stored) {
    console.warn(`home_screen_art="${stored}" is not a known preset; using ${DEFAULT_PRESET}`);
  }
  return DEFAULT_PRESET;
}

/** What the admin panel shows: the stored value plus whether dev is overriding it. */
export async function getHomeScreenArtStatus(): Promise<{
  stored: PlanetPresetName;
  row: AppSetting | null;
  overriddenBy: PlanetPresetName | null;
}> {
  const row = await getSettingRow(HOME_SCREEN_ART);
  const stored = row && isPlanetPreset(row.value) ? row.value : DEFAULT_PRESET;
  return { stored, row, overriddenBy: devOverride() };
}

export async function setHomeScreenArt(value: string, updatedBy: string) {
  if (!isPlanetPreset(value)) {
    throw new Error(`Unknown planet preset: ${value}`);
  }
  await setSetting(HOME_SCREEN_ART, value, updatedBy);
}
