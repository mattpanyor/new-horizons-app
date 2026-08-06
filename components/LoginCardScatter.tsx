// Crew cards dealt face-up around the login box, as if someone tossed them
// onto the table. Decorative only — the layer is pointer-events-none so it
// never intercepts the form. Sits above the dot-grid traveller (which paints
// earlier in DOM order at z-auto) and below the login box (z-10).

/** One resting place in the fan. Cards are assigned to slots in deck order. */
interface Slot {
  /** Horizontal centre, as a multiple of the layer's --spread from the middle. */
  x: number;
  /** Vertical centre, as a % of the viewport. */
  top: string;
  /** Settled rotation. */
  rot: number;
  /** Settled size, so no two cards look laid down from the same height. */
  scale: number;
}

// The deck. A card takes the slot at its index, and later cards lie on top of
// earlier ones. To add art, drop the file in public/login/ and append it here —
// the first four slots are the inner ring around the box, the rest an outer
// ring, so new cards land further out without disturbing the ones already
// framing the box.
const DECK = [
  "/login/vaelin_card.webp",
  "/login/malrik_card.webp",
  "/login/arion_card.webp",
  "/login/dana_card.webp",
  "/login/nova_card.webp",
  "/login/adeline_card.webp",
  "/login/libra_card.webp",
  "/login/emera_card.webp",
  "/login/athena_card.webp",
];

// Dealt last and lying on top of the pile, wherever it sits in the deck — so
// appending art never quietly buries it.
const TOP_CARD = "/login/dana_card.webp";

// Two sets of slots, because the thing they frame is shaped differently.
//
// "form" — a narrow, tall login box: the fan flanks it left and right, inner
// corners tucked behind the box.
//
// "avatar" — a wide, short row of portrait blades: the same placement would
// put card art shoulder-to-shoulder with the blade portraits, so the slots
// split high/low to clear the row instead of crowding it.
//
// Both are deliberately uneven — the sides don't mirror and no two cards share
// a height. The first four slots are the inner ring that frames the box; the
// rest form an outer ring, further out, smaller and turned harder, so a
// growing deck spreads outward rather than piling up on the box.
const SLOTS: Record<"form" | "avatar", Slot[]> = {
  form: [
    { x: 0.78, top: "72%", rot: 26, scale: 0.9 },
    { x: -1.0, top: "39%", rot: -9, scale: 1.03 },
    { x: 1.02, top: "36%", rot: 12, scale: 1 },
    { x: -1.22, top: "66%", rot: -23, scale: 0.94 },
    { x: 1.62, top: "58%", rot: 34, scale: 0.86 },
    { x: -1.7, top: "30%", rot: -31, scale: 0.88 },
    { x: 1.45, top: "19%", rot: -8, scale: 0.82 },
    { x: -1.4, top: "80%", rot: 17, scale: 0.84 },
    { x: 0.25, top: "82%", rot: -13, scale: 0.8 },
  ],
  avatar: [
    { x: 0.98, top: "74%", rot: 24, scale: 0.92 },
    { x: -0.95, top: "72%", rot: -11, scale: 1 },
    { x: 1.08, top: "31%", rot: 13, scale: 0.98 },
    { x: -1.05, top: "34%", rot: -21, scale: 0.95 },
    { x: 1.62, top: "54%", rot: 31, scale: 0.88 },
    { x: -1.65, top: "52%", rot: -28, scale: 0.86 },
    { x: 0.42, top: "84%", rot: 9, scale: 0.82 },
    { x: -0.75, top: "17%", rot: -7, scale: 0.8 },
    { x: 0.62, top: "15%", rot: 15, scale: 0.78 },
  ],
};

// Phones get their own table. Both login surfaces fill the width of a phone
// screen, so a fan *around* the box has nowhere to stand — it ends up under the
// box or off the edge. Instead the deck retreats to the four corners and is
// dealt mostly off-screen, so what shows is a corner of card in the band above
// and below the login box, with the middle of the screen left alone. Only the
// first four cards are dealt on a phone (the CSS hides the rest) — a fan of
// nine at that size is noise, and four corners is the whole idea.
const MOBILE_SLOTS: Slot[] = [
  { x: -1.12, top: "-1%", rot: -15, scale: 1 },
  { x: 1.16, top: "-4%", rot: 13, scale: 0.94 },
  { x: 1.1, top: "101%", rot: -12, scale: 0.98 },
  { x: -1.18, top: "98%", rot: 17, scale: 0.92 },
];

/** Cards past the end of the table wrap around, shifted out and down a little
 *  so they land beside their ring-mates instead of exactly on top of them. */
function slotFor(slots: Slot[], i: number): Slot {
  const base = slots[i % slots.length];
  const lap = Math.floor(i / slots.length);
  if (lap === 0) return base;
  const side = Math.sign(base.x) || 1;
  return {
    x: base.x + side * 0.3 * lap,
    top: `calc(${base.top} + ${lap * 6}%)`,
    rot: base.rot + side * 5 * lap,
    scale: Math.max(0.7, base.scale - 0.05 * lap),
  };
}

interface LoginCardScatterProps {
  /** Which login surface the cards are framing. */
  variant?: "form" | "avatar";
}

export default function LoginCardScatter({ variant = "form" }: LoginCardScatterProps) {
  const slots = SLOTS[variant];

  return (
    <div className={`login-cards login-cards--${variant}`} aria-hidden="true">
      {DECK.map((src, i) => {
        const slot = slotFor(slots, i);
        const mobile = slotFor(MOBILE_SLOTS, i);
        // The top card keeps its slot but is dealt after everything else.
        const order = src === TOP_CARD ? DECK.length : i;
        return (
          <div
            key={src}
            className="login-card"
            style={
              {
                zIndex: order + 1,
                // Two sets of coordinates travel with every card; the
                // stylesheet decides which set is in play at this width.
                "--dx": slot.x,
                "--dtop": slot.top,
                "--drot": `${slot.rot}deg`,
                "--dscale": slot.scale,
                "--mx": mobile.x,
                "--mtop": mobile.top,
                "--mrot": `${mobile.rot}deg`,
                "--mscale": mobile.scale,
                // Dealt in order, and never a long wait however big the deck gets.
                "--delay": `${Math.min(order * 90, 900)}ms`,
              } as React.CSSProperties
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" width={1024} height={1536} className="login-card__art" />
            <div className="login-card__scrim" />
          </div>
        );
      })}
    </div>
  );
}
