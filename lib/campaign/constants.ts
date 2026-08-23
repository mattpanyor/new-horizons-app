// Campaign values shared by the server and the browser.
//
// These deliberately do NOT live in ./service.ts. That module imports the
// database layer, which calls neon(process.env.DATABASE_URL) at module scope —
// so a "use client" component importing a constant from it drags the whole DB
// client into the browser bundle, where the variable is undefined and the page
// dies on hydration. Anything a client component needs belongs here, in
// ./standing.ts, or in ./integrity.ts — all three are pure.

/** The longest a single anonymity line may be. It is a line, not a paragraph. */
export const ANONYMITY_TEXT_MAX = 300;

/** A VIP description is a short dossier note, not a wiki article. */
export const VIP_BLURB_MAX = 600;

/** The eyebrow's editable half. Short — it is wide-tracked uppercase text. */
export const VIP_TAGLINE_MAX = 60;
