"use client";

// Crew cards dealt face-up around the login box, as if someone tossed them onto
// the table. Decorative only — the layer is pointer-events-none so it never
// intercepts the form. Sits above the dot-grid traveller (which paints earlier
// in DOM order at z-auto) and below the login box (z-10).
//
// Four cards at a time, two a side, in random slots with random art. Every
// twelve seconds the hand is swept and a new one dealt; the outgoing batch lifts
// away while the incoming one lands, so the table is never empty. Repeats
// across batches are fine and expected — within a single batch they are not,
// since the same face in two places at once reads as a bug.

import { useEffect, useMemo, useState } from "react";

/** One resting place in the fan. */
interface Slot {
  /** Horizontal centre, as a multiple of the layer's --spread from the middle.
   *  Sign decides which side of the box the card lands on. */
  x: number;
  /** Vertical centre, as a % of the viewport. */
  top: string;
  /** Settled rotation. */
  rot: number;
  /** Settled size, so no two cards look laid down from the same height. */
  scale: number;
}

// The deck. To add art, drop the file in public/login/ and append it here.
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

// Two sets of slots, because the thing they frame is shaped differently.
//
// "form" — a narrow, tall login box: the fan flanks it left and right, inner
// corners tucked behind the box.
//
// "avatar" — a wide, short row of portrait blades: the same placement would put
// card art shoulder-to-shoulder with the blade portraits, so the slots split
// high/low to clear the row instead of crowding it.
//
// Deliberately uneven — the sides don't mirror and no two share a height. With
// only four cards dealt from these, the fan looks different every round.
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
    // The slot that sat at { x: -1.05, top: "34%" } is deliberately gone: it
    // lands squarely over the upper-left of the frame where it crowds the
    // heading. Its neighbour in the upper left is fine and stays.
    { x: 1.62, top: "54%", rot: 31, scale: 0.88 },
    { x: -1.65, top: "52%", rot: -28, scale: 0.86 },
    { x: 0.42, top: "84%", rot: 9, scale: 0.82 },
    { x: -0.50, top: "17%", rot: 11, scale: 0.8 },
    { x: 0.62, top: "15%", rot: 15, scale: 0.78 },
  ],
};

// Phones get their own table. Both login surfaces fill the width of a phone
// screen, so a fan *around* the box has nowhere to stand. Instead the deck
// retreats to the four corners and is dealt mostly off-screen, so what shows is
// a corner of card in the band above and below the login box. Two a side, which
// is exactly a batch.
const MOBILE_SLOTS: Slot[] = [
  { x: -1.12, top: "-1%", rot: -15, scale: 1 },
  { x: 1.16, top: "-4%", rot: 13, scale: 0.94 },
  { x: 1.1, top: "101%", rot: -12, scale: 0.98 },
  { x: -1.18, top: "98%", rot: 17, scale: 0.92 },
];

const CARDS_PER_SIDE = 2;
const ROUND_MS = 12000;

interface Placed {
  src: string;
  slot: Slot;
  mobile: Slot;
}

interface Batch {
  id: number;
  cards: Placed[];
}

/** `count` distinct entries, chosen without replacement. */
function pick<T>(from: T[], count: number): T[] {
  const pool = from.slice();
  const out: T[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

function deal(variant: "form" | "avatar", id: number): Batch {
  const slots = SLOTS[variant];
  const left = pick(slots.filter((s) => s.x < 0), CARDS_PER_SIDE);
  const right = pick(slots.filter((s) => s.x > 0), CARDS_PER_SIDE);
  const mobileLeft = pick(MOBILE_SLOTS.filter((s) => s.x < 0), CARDS_PER_SIDE);
  const mobileRight = pick(MOBILE_SLOTS.filter((s) => s.x > 0), CARDS_PER_SIDE);

  // Art is drawn for the batch as a whole, so the same face can't appear twice
  // in one hand. Across hands it can, which is fine — the deck is small.
  const art = pick(DECK, CARDS_PER_SIDE * 2);
  const slotsInOrder = [...left, ...right];
  const mobileInOrder = [...mobileLeft, ...mobileRight];

  return {
    id,
    cards: slotsInOrder.map((slot, i) => ({
      src: art[i] ?? DECK[i % DECK.length],
      slot,
      mobile: mobileInOrder[i] ?? MOBILE_SLOTS[i % MOBILE_SLOTS.length],
    })),
  };
}

interface LoginCardScatterProps {
  /** Which login surface the cards are framing. */
  variant?: "form" | "avatar";
}

export default function LoginCardScatter({ variant = "form" }: LoginCardScatterProps) {
  // Nothing is dealt during render. The layout is random, so a server-rendered
  // hand would never match the one the client picks, and React would report a
  // hydration mismatch — the first batch is dealt on mount instead.
  const [batches, setBatches] = useState<Batch[]>([]);

  useEffect(() => {
    const next = () =>
      setBatches((cur) => {
        // The id is derived from what is already on the table, not from a
        // counter the effect owns. A local counter resets every time the effect
        // re-runs — which React does deliberately on mount in development — so
        // the second run would deal another batch numbered 1 while the first was
        // still in state, and two children would share a key.
        const id = (cur[cur.length - 1]?.id ?? 0) + 1;
        // Keep the outgoing batch alongside the incoming one so they cross over;
        // only ever two on the table at once.
        return [...cur.slice(-1), deal(variant, id)];
      });
    next();
    const timer = setInterval(next, ROUND_MS);
    return () => clearInterval(timer);
  }, [variant]);

  const newest = useMemo(() => batches[batches.length - 1]?.id, [batches]);

  return (
    <div className={`login-cards login-cards--${variant}`} aria-hidden="true">
      {batches.map((batch) => (
        // Grouped per batch so the phone rule that culls past the fourth card
        // counts within a hand rather than across the overlap.
        <div key={batch.id} className="login-cards__batch">
          {batch.cards.map((card, i) => (
            <div
              key={`${batch.id}-${i}`}
              className={`login-card${batch.id === newest ? "" : " login-card--out"}`}
              style={
                {
                  zIndex: i + 1,
                  // Two sets of coordinates travel with every card; the
                  // stylesheet decides which set is in play at this width.
                  "--dx": card.slot.x,
                  "--dtop": card.slot.top,
                  "--drot": `${card.slot.rot}deg`,
                  "--dscale": card.slot.scale,
                  "--mx": card.mobile.x,
                  "--mtop": card.mobile.top,
                  "--mrot": `${card.mobile.rot}deg`,
                  "--mscale": card.mobile.scale,
                  // Dealt in order, quickly — the whole hand is down well
                  // inside the round.
                  "--delay": `${i * 110}ms`,
                } as React.CSSProperties
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={card.src} alt="" width={1024} height={1536} className="login-card__art" />
              <div className="login-card__scrim" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
