// Single source of truth for the Kanka campaign URL.
//
// Kept free of DB / server-only imports so it can be used from client
// components (e.g. clue mention rendering) without dragging the Postgres
// driver into the client bundle.

export const KANKA_CAMPAIGN_ID = "96303";

export function kankaEntityUrl(entityId: number | string): string {
  return `https://app.kanka.io/w/${KANKA_CAMPAIGN_ID}/entities/${entityId}`;
}

/**
 * Kanka's inline entity markup: [character:5976841], [location:8424926].
 *
 * The ids are entity_ids — the same space as kankaEntityUrl — unlike Kanka's
 * relation payloads, which use type-local ids. `[TODO date]` and other prose
 * in square brackets is left alone: the pattern needs a colon and digits.
 */
const KANKA_REF_RE = /\[[a-z_]+:(\d+)\]/gi;

const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

/**
 * Kanka's `entry` HTML as plain text.
 *
 * Descriptions are authored in Kanka's rich-text editor and stored as raw HTML.
 * Nothing in this app renders HTML — there is no dangerouslySetInnerHTML
 * anywhere — so text destined for a React text node has to be flattened first,
 * or the markup shows up literally on screen.
 *
 * Flattening rather than sanitising is the deliberate choice: it cannot carry a
 * script, an iframe or an attribute through by construction, so it stays safe
 * even though the source is an external system the app does not control.
 *
 * `names` resolves inline references to the entity's name. A reference to
 * something not in the map is dropped rather than printed raw — a reader is
 * better served by a slightly clipped sentence than by "[character:5976841]".
 */
export function kankaEntryToText(entry: string, names?: Map<number, string>): string {
  return entry
    .replace(KANKA_REF_RE, (_m, id: string) => names?.get(Number(id)) ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/(p|div|ul|ol|h[1-6])>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/gi, (m) => HTML_ENTITIES[m.toLowerCase()] ?? m)
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
