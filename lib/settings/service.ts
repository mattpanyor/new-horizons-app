// App settings policy.
//
// Following the rule in CLAUDE.md: validation lives here, not in the route
// handler, so the admin panel and any future surface (MCP, a script, a seed)
// all get the same rules. Routes are thin adapters over these functions.

import { cache } from "react";
import { unstable_cache, revalidateTag } from "next/cache";
import { getSettingRow, setSetting, type AppSetting } from "@/lib/db/settings";
import { DEFAULT_PRESET, PLANET_PRESETS, type PlanetPresetName } from "@/lib/planetPresets";

export const HOME_SCREEN_ART = "home_screen_art";

/** Cache tag for anything derived from app_settings. */
const SETTINGS_TAG = "app_settings";

/**
 * The stored row, cached two ways.
 *
 * `unstable_cache` holds it across requests so a value that changes maybe
 * monthly is not a database round trip on every page render — this runs in the
 * root layout, so without it every route pays for it, and most of them never
 * render the background at all.
 *
 * No time-based revalidation. It would not make an admin's change visible any
 * sooner — `revalidateTag` on save already does that immediately — so its only
 * job would be to recover from a failure that got cached. That is fixed at the
 * source instead: the read throws rather than returning a fallback, and
 * `unstable_cache` does not cache a rejection, so a database blip degrades that
 * one request and the next one retries. Nothing to expire.
 *
 * The consequence to know about: a change made directly in SQL, bypassing the
 * admin panel, will not appear until something invalidates the tag or the
 * deployment is replaced.
 */
const readSettingRowUncaught = unstable_cache(
  async () => getSettingRow(HOME_SCREEN_ART),
  ["home-screen-art"],
  { revalidate: false, tags: [SETTINGS_TAG] },
);

/** `cache` adds per-request dedup, which matters on /admin/settings where the
 *  layout and the page both want the value. The catch is out here so that a
 *  failure falls back for this request only and is never stored. */
const readSettingRow = cache(async (): Promise<AppSetting | null> => {
  try {
    return await readSettingRowUncaught();
  } catch (err) {
    console.error("home_screen_art read failed; using the default:", err);
    return null;
  }
});

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

  const row = await readSettingRow();
  const stored = row?.value;
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
  const row = await readSettingRow();
  const stored = row && isPlanetPreset(row.value) ? row.value : DEFAULT_PRESET;
  return { stored, row, overriddenBy: devOverride() };
}

export async function setHomeScreenArt(value: string, updatedBy: string) {
  if (!isPlanetPreset(value)) {
    throw new Error(`Unknown planet preset: ${value}`);
  }
  const row = await setSetting(HOME_SCREEN_ART, value, updatedBy);
  // Drops the cross-request cache so the change is live on the next render
  // rather than up to `revalidate` seconds later. Next 16 requires a lifetime
  // here; `{ expire: 0 }` is immediate. (`updateTag` would be the read-your-
  // own-writes version, but it is only callable from a Server Action and this
  // is a route handler.)
  revalidateTag(SETTINGS_TAG, { expire: 0 });
  return { stored: value, row, overriddenBy: devOverride() };
}
