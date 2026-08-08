// A frame for a camera feed in an OBS browser source. Entirely server-rendered:
// no state, so the browser source runs no JavaScript of ours at all.
//
// It draws the frame and nothing else, to be layered above a camera source in
// OBS. It does not carry the feed itself — embedding one was tried and does not
// work here, so if the thought comes up again, see the note in the page.
//
// What this file owns is the geometry, and only that. The band is a solid ring
// around the picture — which doubles as a matte, covering the camera's own edges
// so a feed that isn't quite the shape of the source has its mismatch hidden
// rather than showing as bars — and a strip at the very bottom is left clear so
// the nameplate can hang half out of it. How any of that is painted belongs to
// the theme; see camFrameThemes.tsx.

import { THEMES, type Metrics, type ThemeName } from "./camFrameThemes";

interface Props {
  /** Shown on the plate at the bottom edge. Omitted draws no plate. */
  name?: string;
  /**
   * Fills the opening with the theme's backdrop instead of leaving it clear.
   *
   * Only for looking at the frame on its own in a browser. In OBS this must stay
   * off, or the page covers the camera it is supposed to be framing.
   */
  opaque?: boolean;
  /** Multiplies every dimension of the frame. 1 suits a 1920x1080 source. */
  scale?: number;
  /**
   * The same, for the nameplate alone. Defaults to `scale`.
   *
   * Separate because the two have different lower bounds. The frame only has to
   * read as a frame, which it does at a thickness the name would be unreadable
   * at — so on a small source the name wants to be proportionally bigger than
   * the band, and one multiplier can't do both.
   */
  nameScale?: number;
  /** Which look to wear. Defaults to the app's own. */
  theme?: ThemeName;
}

export default function CamFrame({
  name,
  opaque = false,
  scale = 1,
  nameScale,
  theme = "nexus",
}: Props) {
  const t = THEMES[theme];
  const ns = nameScale ?? scale;

  // Sizes are proportional — a hundredth of the source's shorter side, so 1 unit
  // is 10.8px at 1080p — with a pixel floor under each. The floor matters for a
  // small source: at 400px tall a proportional hairline rounds away to nothing
  // and the name stops being readable, so below that size the frame stops
  // shrinking and just takes a larger share of the picture, which is what a
  // small picture needs anyway.
  const at = (s: number) => (min: number, n: number) =>
    `max(${(min * s).toFixed(2)}px, ${(n * s).toFixed(3)}vmin)`;
  const u = at(scale); // the frame
  const p = at(ns); // the nameplate

  const BAND = u(...t.band);
  // The plate, and the clear strip below the frame that is half its height by
  // definition. The strip follows the plate rather than the frame — otherwise
  // the two come apart as soon as the scales differ.
  const PLATE = p(...t.plate);
  const DROP = `calc(${PLATE} / 2)`;

  const opening = {
    top: BAND,
    left: BAND,
    right: BAND,
    bottom: `calc(${DROP} + ${BAND})`,
  };

  const m: Metrics = { u, p, BAND, PLATE, DROP, opening, name };

  return (
    <div className="fixed inset-0 overflow-hidden">
      {opaque && (
        <div className="absolute" style={{ ...opening, background: t.backdrop ?? "#000" }} />
      )}
      {/* Never clickable — OBS does not click, but the page is also openable in
          a browser to check it. */}
      <div className="pointer-events-none absolute inset-0">{t.Chrome(m)}</div>
    </div>
  );
}
