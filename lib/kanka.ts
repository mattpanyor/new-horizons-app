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

// Kanka's rich-text editor emits typographic entities freely — a straight
// apostrophe becomes &rsquo; the moment the GM types one. Numerics are decoded
// generically below; this table covers the named ones that editor produces.
const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&rsquo;": "\u2019",
  "&lsquo;": "\u2018",
  "&rdquo;": "\u201d",
  "&ldquo;": "\u201c",
  "&mdash;": "\u2014",
  "&ndash;": "\u2013",
  "&hellip;": "\u2026",
  "&middot;": "\u00b7",
  "&bull;": "\u2022",
  "&deg;": "\u00b0",
  "&times;": "\u00d7",
  "&laquo;": "\u00ab",
  "&raquo;": "\u00bb",
};

/**
 * One HTML entity as its character.
 *
 * Numeric forms are decoded arithmetically so the table does not have to list
 * them, and an out-of-range or malformed code point falls back to the literal
 * text rather than throwing. Anything unrecognised is left as written: a stray
 * "&foo;" on screen is odd but honest, where silently dropping it would eat a
 * word the GM did write.
 */
function decodeEntity(raw: string): string {
  const named = HTML_ENTITIES[raw.toLowerCase()];
  if (named !== undefined) return named;

  const numeric = /^&#(x)?([0-9a-f]+);$/i.exec(raw);
  if (numeric) {
    const code = Number.parseInt(numeric[2], numeric[1] ? 16 : 10);
    if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
      try {
        return String.fromCodePoint(code);
      } catch {
        return raw;
      }
    }
  }
  return raw;
}

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
    .replace(/&#?[a-z0-9]+;/gi, decodeEntity)
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
