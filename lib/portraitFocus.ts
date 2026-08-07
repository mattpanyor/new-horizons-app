// Where to crop a crew portrait when the frame is much wider than it is tall.
//
// The phone login blade is a strip about five times wider than it is tall, so
// `object-top` shows the band of sky above someone's head and `center` shows a
// collarbone. The strip only reveals a seventh of the picture, so guessing one
// position for every portrait can't work — a 5% error is the difference between
// eyes and a forehead. These numbers are measured off the art instead.

/**
 * Eye-line of each portrait, as a percentage of the picture's height.
 *
 * Keyed by image filename rather than by username: the eye-line is a property
 * of the picture, so new art for the same crew member needs a new measurement,
 * and two users sharing a portrait share it for free. To add one, open the
 * image, find the eyes, and divide by the image height.
 */
const EYE_LINE: Record<string, number> = {
  "vaelin_portrait.png": 29,
  "malrik_portrait.png": 23,
  "danarill_profile.png": 20.5,
  "arion_portrait.png": 18,
  // Not a face — the Society sigil. Centred on the glowing core, which is what
  // the eye goes to anyway.
  "society_logo.png": 42,
};

/** Portraits with no measurement land here: roughly where a head-and-shoulders
 *  composition puts the eyes. Wrong for a full-body shot, but never as wrong as
 *  the top edge. */
const DEFAULT_EYE_LINE = 24;

/** Share of the picture a phone blade shows. Two-thirds of the crew art is 2:3,
 *  which at strip proportions leaves about this much visible. */
const VISIBLE_BAND = 0.15;

/**
 * `object-position` that lands the eye-line in the middle of the visible band.
 *
 * A percentage in `object-position` doesn't address the picture directly — it
 * scrolls through whatever the frame *doesn't* show, so with a band this tall
 * an eye-line of E resolves to (E − 7.5) / 0.85. Frames with no vertical
 * overflow — the tall blades from `sm` up — ignore the value entirely, so this
 * is safe to apply at every width.
 */
export function portraitFocus(imageUrl: string | null): string {
  const file = imageUrl?.split("?")[0].split("/").pop() ?? "";
  const eye = EYE_LINE[file] ?? DEFAULT_EYE_LINE;
  const y = (eye - (VISIBLE_BAND * 100) / 2) / (1 - VISIBLE_BAND);
  return `50% ${Math.min(100, Math.max(0, y)).toFixed(1)}%`;
}
