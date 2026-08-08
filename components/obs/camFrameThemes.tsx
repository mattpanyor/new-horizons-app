// The six looks CamFrame can wear, picked with ?theme=.
//
// A theme owns everything drawn on top of the picture: the band, its decoration
// and the nameplate. CamFrame owns only the geometry — how thick the band is,
// where the opening sits, how far the plate hangs below it — and hands that to
// the theme as `Metrics`, so a theme can be written without re-deriving any of
// it and every theme stays consistent under `scale` and `namescale`.
//
// ONE RULE, and it is not stylistic: the band's outer silhouette must be a full
// square that reaches all four edges of the source. In overlay mode the camera
// is a separate source of the same size sitting directly behind this page, so
// any pixel the band does not cover shows raw camera. A cut corner, a rounded
// corner, an inset margin — each leaves a notch of bare feed at the edge of the
// frame. An earlier pass had chamfered and rounded outer corners and all of them
// leaked exactly that way.
//
// So corner shaping happens on the *inside* only, where it is painted over the
// picture and covers rather than reveals:
//
//   Cut     a triangle of band colour laid over the opening's corner.
//   Round   `border-radius` on the opening to clip the feed, plus `fillet` to
//           fill the concave gap that leaves between it and the square band.
//
// Detail is what separates these from a wireframe, and it is mostly four things:
// a bright core line with a wider dim halo behind it rather than one stroke;
// glow; runs that step and break instead of going corner to corner; and density
// that clusters at the corners and thins out along the edges.

import type { CSSProperties, ReactNode } from "react";

export interface Metrics {
  /** A frame-scaled length with a pixel floor: `u(min, vmin)`. */
  u: (min: number, n: number) => string;
  /** The same at the nameplate's scale. */
  p: (min: number, n: number) => string;
  /** Band thickness, already resolved. */
  BAND: string;
  /** Nameplate height. */
  PLATE: string;
  /** The clear strip below the frame — half a plate, by definition. */
  DROP: string;
  /** The opening's rectangle, as inset properties. */
  opening: CSSProperties;
  /** Absent when no name was given; draw no plate in that case. */
  name?: string;
}

export interface CamTheme {
  label: string;
  /** Band thickness as `[pixel floor, vmin]`. */
  band: readonly [number, number];
  /** Nameplate height, the same way, at the nameplate's scale. */
  plate: readonly [number, number];
  /** Behind the feed, where `bg` is opaque. Defaults to black. */
  backdrop?: string;
  Chrome: (m: Metrics) => ReactNode;
}

/* ---------------------------------------------------------------- helpers */

const ALL_CORNERS = ["tl", "tr", "bl", "br"] as const;
type Corner = (typeof ALL_CORNERS)[number];

const vEdge = (k: Corner) => (k[0] === "t" ? "top" : "bottom");
const hEdge = (k: Corner) => (k[1] === "l" ? "left" : "right");

/** Layered shadow: tight core, wide bloom. The thing that reads as "neon". */
function neon(m: Metrics, core: string, halo: string): string {
  return `0 0 ${m.u(2, 0.35)} ${core}, 0 0 ${m.u(8, 1.4)} ${halo}, 0 0 ${m.u(18, 3.2)} ${halo}`;
}

/**
 * Fills the concave gap left when a rounded opening sits in a square band.
 *
 * The band's inner corner is a right angle; the feed is clipped to a curve. The
 * sliver between them would otherwise be transparent, which in overlay mode
 * means camera. A radial gradient with a hard stop paints everything outside the
 * quarter-circle, so the frame reads as rounded while staying opaque to the edge.
 */
function fillet(radius: string, colour: string) {
  return ALL_CORNERS.map((k) => (
    <div
      key={`fil${k}`}
      className="absolute"
      style={{
        [vEdge(k)]: 0,
        [hEdge(k)]: 0,
        width: radius,
        height: radius,
        background: `radial-gradient(circle at ${k[1] === "l" ? "100%" : "0%"} ${
          k[0] === "t" ? "100%" : "0%"
        }, transparent 0 calc(${radius} - 0.5px), ${colour} calc(${radius} - 0.5px))`,
      }}
    />
  ));
}

const TRIANGLE: Record<Corner, string> = {
  tl: "polygon(0 0,100% 0,0 100%)",
  tr: "polygon(0 0,100% 0,100% 100%)",
  bl: "polygon(0 0,0 100%,100% 100%)",
  br: "polygon(100% 0,100% 100%,0 100%)",
};

/** A run of evenly spaced dashes, for rulers and scales. */
function dashes(colour: string, dash: string, period: string) {
  return `repeating-linear-gradient(to right, ${colour} 0 ${dash}, transparent ${dash} ${period})`;
}

/** A row of bolt heads, as a background rather than as elements. */
function rivetRow(colour: string, period: string) {
  return {
    backgroundImage: `radial-gradient(circle, ${colour} 0 26%, transparent 28%)`,
    backgroundSize: `${period} 100%`,
    backgroundRepeat: "repeat-x",
  };
}

/** Diagonal hazard stripes. */
function hazard(a: string, b: string, w: string) {
  return `repeating-linear-gradient(45deg, ${a} 0 ${w}, ${b} ${w} calc(${w} * 2))`;
}

/** Faint horizontal lines over the picture, for the CRT themes. */
function scanlines(colour: string, period: string, radius?: string) {
  return (
    <div
      className="absolute inset-0"
      style={{
        borderRadius: radius,
        backgroundImage: `repeating-linear-gradient(to bottom, ${colour} 0 1px, transparent 1px ${period})`,
      }}
    />
  );
}

const cinzel = { fontFamily: "var(--font-cinzel), serif" };
const geist = { fontFamily: "var(--font-geist-sans), system-ui, sans-serif" };
const mono = {
  fontFamily: 'var(--font-geist-mono), ui-monospace, "SF Mono", Menlo, monospace',
};

/** The plate box, straddling the frame's bottom edge. Themes fill it. */
function plateBox(m: Metrics, style: CSSProperties, children: ReactNode) {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center"
      style={{ bottom: 0, height: m.PLATE, ...style }}
    >
      {children}
    </div>
  );
}

/** The band itself: a solid border, square to the source's edges. */
function bandBox(m: Metrics, colour: string, extra?: CSSProperties) {
  return (
    <div
      className="absolute"
      style={{
        top: 0,
        left: 0,
        right: 0,
        bottom: m.DROP,
        borderStyle: "solid",
        borderColor: colour,
        borderWidth: m.BAND,
        ...extra,
      }}
    />
  );
}

/* ------------------------------------------------------------- 1 · nexus */

/** The app's own language: indigo on near-black, square, corner brackets. */
const NEXUS_FRAME = "rgba(4,6,18,0.97)";

const nexus: CamTheme = {
  label: "Nexus — the app's own indigo",
  band: [15, 2.8],
  plate: [26, 4.4],
  Chrome: (m) => {
    const EDGE = m.u(2, 0.3);
    const HAIR = m.u(1, 0.15);
    const BRACKET = m.u(26, 7);
    const DIAMOND = m.u(5, 0.8);
    const TICK = m.u(10, 2.6);
    const NUB = m.u(4, 0.6);
    const GAP = m.u(2, 0.5);
    const CORNER = m.p(8, 1.5);
    const PEDGE = m.p(2, 0.3);
    const spark = { boxShadow: `0 0 ${m.u(4, 0.8)} rgba(129,140,248,0.9)` };

    const bracket = (v: "top" | "bottom", h: "left" | "right") => (
      <div
        key={`b${v}${h}`}
        className="absolute border-indigo-400/85"
        style={{
          [v]: 0,
          [h]: 0,
          width: BRACKET,
          height: BRACKET,
          [`border${v === "top" ? "Top" : "Bottom"}Width`]: EDGE,
          [`border${h === "left" ? "Left" : "Right"}Width`]: EDGE,
          borderStyle: "solid",
        }}
      />
    );
    const diamond = (v: "top" | "bottom", h: "left" | "right") => (
      <div
        key={`d${v}${h}`}
        className="absolute bg-indigo-400"
        style={{
          [v]: 0,
          [h]: 0,
          width: DIAMOND,
          height: DIAMOND,
          transform: `translate(${h === "left" ? "-50%" : "50%"}, ${v === "top" ? "-50%" : "50%"}) rotate(45deg)`,
          ...spark,
        }}
      />
    );
    const tick = (dir: "h" | "v") => (
      <div className={`flex items-center ${dir === "v" ? "flex-col" : ""}`} style={{ gap: GAP }}>
        <div
          className="bg-indigo-400/50"
          style={dir === "h" ? { width: TICK, height: HAIR } : { height: TICK, width: HAIR }}
        />
        <div className="rotate-45 bg-indigo-400/80" style={{ width: NUB, height: NUB }} />
        <div
          className="bg-indigo-400/50"
          style={dir === "h" ? { width: TICK, height: HAIR } : { height: TICK, width: HAIR }}
        />
      </div>
    );
    const plateCorner = (v: "top" | "bottom", h: "left" | "right") => (
      <div
        key={`p${v}${h}`}
        className="absolute border-indigo-400/85"
        style={{
          [v]: 0,
          [h]: 0,
          width: CORNER,
          height: CORNER,
          [`border${v === "top" ? "Top" : "Bottom"}Width`]: PEDGE,
          [`border${h === "left" ? "Left" : "Right"}Width`]: PEDGE,
          borderStyle: "solid",
        }}
      />
    );

    return (
      <>
        {bandBox(m, NEXUS_FRAME)}
        <div className="absolute" style={m.opening}>
          <div
            className="absolute inset-0 border-indigo-400/45"
            style={{ borderWidth: HAIR, borderStyle: "solid" }}
          />
          <div
            className="absolute inset-x-0 top-0 bg-gradient-to-r from-transparent via-indigo-400/80 to-transparent"
            style={{ height: EDGE }}
          />
          <div
            className="absolute inset-x-0 bottom-0 bg-gradient-to-r from-transparent via-indigo-400/80 to-transparent"
            style={{ height: EDGE }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-b from-transparent via-indigo-400/55 to-transparent"
            style={{ width: EDGE }}
          />
          <div
            className="absolute inset-y-0 right-0 bg-gradient-to-b from-transparent via-indigo-400/55 to-transparent"
            style={{ width: EDGE }}
          />
          {(["top", "bottom"] as const).flatMap((v) =>
            (["left", "right"] as const).flatMap((h) => [bracket(v, h), diamond(v, h)]),
          )}
          <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">{tick("h")}</div>
          <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2">{tick("v")}</div>
          <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2">{tick("v")}</div>
        </div>

        {m.name &&
          plateBox(
            m,
            { padding: `0 ${m.p(16, 3.4)}` },
            <>
              <div className="absolute inset-0" style={{ background: NEXUS_FRAME }} />
              <div
                className="absolute inset-x-0 top-0 bg-gradient-to-r from-transparent via-indigo-400/85 to-transparent"
                style={{ height: PEDGE }}
              />
              <div
                className="absolute inset-x-0 bottom-0 bg-gradient-to-r from-transparent via-indigo-400/85 to-transparent"
                style={{ height: PEDGE }}
              />
              {(["top", "bottom"] as const).flatMap((v) =>
                (["left", "right"] as const).map((h) => plateCorner(v, h)),
              )}
              <span
                className="relative leading-none font-semibold uppercase text-white/90 whitespace-nowrap"
                style={{ ...cinzel, fontSize: m.p(14, 2.5), letterSpacing: m.p(3, 0.7) }}
              >
                {m.name}
              </span>
            </>,
          )}
      </>
    );
  },
};

/* -------------------------------------------------------------- 2 · deco */

/**
 * Art Deco, by way of Rapture: brass on black, rigidly symmetrical.
 *
 * The vocabulary is the period's own — stepped corners, a sunburst fan, fluted
 * pilasters, chevrons and a cartouche for the name — rather than a sci-fi frame
 * painted gold. Two things carry it: nothing is a single line (every rule is
 * paired, heavy inside and hairline outside, which is what reads as deco rather
 * than as an outline), and the corners are three parallel bars stepping inward
 * instead of one bracket.
 */
const DECO_DARK = "rgba(9,8,6,0.97)";
const DECO_GOLD = "#D4AF37";
const DECO_LIGHT = "#F7E7B4";
const DECO_MID = "rgba(212,175,55,0.62)";
const DECO_DIM = "rgba(212,175,55,0.30)";

const deco: CamTheme = {
  label: "Deco — brass Art Deco, stepped corners and sunburst",
  band: [30, 5.6],
  plate: [32, 5.2],
  backdrop: "#090806",
  Chrome: (m) => {
    const HAIR = m.u(1, 0.18);
    const RULE = m.u(4, 0.62);
    const BAR = m.u(3, 0.55); // one bar of a stepped corner
    const GAP = m.u(4, 0.8); // and the air between them
    const ARM = m.u(58, 13); // how far the longest bar runs
    const FAN = m.u(96, 20);
    const CHEV = m.u(16, 3);

    /** Three parallel bars stepping in from the corner, longest outermost. */
    const stepped = (k: Corner) => {
      const V = vEdge(k);
      const H = hEdge(k);
      return [0, 1, 2].map((i) => {
        const off = `calc((${BAR} + ${GAP}) * ${i})`;
        const len = `calc(${ARM} - (${BAR} + ${GAP}) * ${i} * 2.2)`;
        const tone = i === 0 ? DECO_GOLD : i === 1 ? DECO_MID : DECO_DIM;
        return (
          <div key={`st${k}${i}`}>
            <div
              className="absolute"
              style={{ [V]: off, [H]: off, width: len, height: BAR, background: tone }}
            />
            <div
              className="absolute"
              style={{ [V]: off, [H]: off, width: BAR, height: len, background: tone }}
            />
          </div>
        );
      });
    };

    /** A V, pointing away from the edge it sits on. */
    const chevron = (style: CSSProperties) => (
      <div
        className="absolute"
        style={{
          width: CHEV,
          height: CHEV,
          background: DECO_GOLD,
          clipPath: "polygon(0 0,50% 45%,100% 0,100% 30%,50% 75%,0 30%)",
          ...style,
        }}
      />
    );

    return (
      <>
        {bandBox(m, DECO_DARK)}

        {/* Fluted pilasters down the two uprights, the way a deco doorway is
            ribbed. Texture rather than structure, but it has to be visible to
            count — an earlier pass had these so faint they may as well not have
            been drawn. */}
        {(["left", "right"] as const).map((side) => (
          <div
            key={side}
            className="absolute"
            style={{
              [side]: 0,
              top: 0,
              bottom: m.DROP,
              width: m.BAND,
              backgroundImage: `repeating-linear-gradient(to right, ${DECO_MID} 0 ${HAIR}, transparent ${HAIR} ${m.u(
                8,
                1.5,
              )})`,
              opacity: 0.9,
            }}
          />
        ))}

        {/* Sunburst over the top rail, rays fanning up from the centre. */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            top: `calc(-1 * ${FAN} / 6)`,
            width: FAN,
            height: `calc(${FAN} / 2)`,
            background: `repeating-conic-gradient(from 180deg at 50% 100%, ${DECO_GOLD} 0deg 1.4deg, transparent 1.4deg 6deg)`,
            maskImage: "radial-gradient(circle at 50% 100%, #000 20%, transparent 88%)",
            WebkitMaskImage: "radial-gradient(circle at 50% 100%, #000 20%, transparent 88%)",
          }}
        />

        <div className="absolute" style={m.opening}>
          {/* The paired rule: heavy inside, hairline outside. */}
          <div
            className="absolute inset-0"
            style={{ borderWidth: RULE, borderStyle: "solid", borderColor: DECO_GOLD }}
          />
          <div
            className="absolute"
            style={{
              inset: `calc(-1 * ${m.u(6, 1.1)})`,
              borderWidth: HAIR,
              borderStyle: "solid",
              borderColor: DECO_MID,
            }}
          />
          {ALL_CORNERS.map((k) => stepped(k))}

          {chevron({ top: 0, left: "50%", transform: "translate(-50%,-42%) rotate(180deg)" })}
          {chevron({ top: "50%", left: 0, transform: "translate(-42%,-50%) rotate(90deg)" })}
          {chevron({ top: "50%", right: 0, transform: "translate(42%,-50%) rotate(-90deg)" })}
        </div>

        {/* Stepped cartouche. Two shoulders each side, decreasing — the one place
            the stepping runs horizontally rather than into a corner. */}
        {m.name &&
          plateBox(
            m,
            { padding: `0 ${m.p(28, 5.0)}` },
            <>
              {(["left", "right"] as const).flatMap((side) =>
                [0, 1].map((i) => (
                  <div
                    key={`sh${side}${i}`}
                    className="absolute"
                    style={{
                      [side]: `calc(-1 * ${m.p(8, 1.4)} * ${i + 1})`,
                      top: `calc(${m.p(5, 0.9)} * ${i + 1})`,
                      bottom: `calc(${m.p(5, 0.9)} * ${i + 1})`,
                      width: m.p(8, 1.4),
                      background: DECO_DARK,
                      borderTop: `${m.p(2, 0.35)} solid ${DECO_GOLD}`,
                      borderBottom: `${m.p(2, 0.35)} solid ${DECO_GOLD}`,
                    }}
                  />
                )),
              )}
              <div className="absolute inset-0" style={{ background: DECO_DARK }} />
              <div
                className="absolute inset-0"
                style={{
                  borderWidth: m.p(3, 0.45),
                  borderStyle: "solid",
                  borderColor: DECO_GOLD,
                }}
              />
              <div
                className="absolute"
                style={{
                  inset: m.p(5, 0.85),
                  borderWidth: m.p(1, 0.18),
                  borderStyle: "solid",
                  borderColor: DECO_MID,
                }}
              />
              <span
                className="relative leading-none font-semibold uppercase whitespace-nowrap"
                style={{
                  ...cinzel,
                  color: DECO_LIGHT,
                  fontSize: m.p(15, 2.6),
                  letterSpacing: m.p(4, 0.9),
                }}
              >
                {m.name}
              </span>
            </>,
          )}
      </>
    );
  },
};

/* ---------------------------------------------------------- 3 · sentinel */

/**
 * The neon HUD frame: cyan, glowing, with stepped notches at every corner.
 *
 * Built from segments rather than a border, because the whole character is in
 * the run breaking and stepping inward before it reaches the corner. Each corner
 * is an assembly of five pieces — two heavy arms, a riser, a return and a node —
 * and the edges between them are separate lines that fade out at both ends, so
 * nothing ever meets at a plain right angle.
 */
const SENT_DARK = "rgba(3,10,14,0.97)";
const SENT_CYAN = "#22D3EE";
const SENT_PALE = "#A5F3FC";
const SENT_HALO = "rgba(34,211,238,0.55)";

const sentinel: CamTheme = {
  label: "Sentinel — neon HUD, stepped notches",
  band: [17, 3.2],
  plate: [28, 4.6],
  Chrome: (m) => {
    const THICK = m.u(4, 0.62); // the heavy arms
    const THIN = m.u(2, 0.3); // risers and returns
    const ARM = m.u(30, 7.5); // how far a heavy arm runs
    const STEP = m.u(16, 3.4); // how far the notch steps in
    const RISE = m.u(9, 1.8); // and how far down
    const NODE = m.u(7, 1.2);
    const bloom = neon(m, SENT_CYAN, SENT_HALO);

    /** One corner's worth of ironmongery, mirrored by anchor. */
    const rig = (k: Corner) => {
      const V = vEdge(k);
      const H = hEdge(k);
      return (
        <div key={`rig${k}`}>
          {/* heavy arm along the horizontal */}
          <div
            className="absolute"
            style={{
              [V]: 0,
              [H]: 0,
              width: ARM,
              height: THICK,
              background: SENT_CYAN,
              boxShadow: bloom,
            }}
          />
          {/* heavy arm down the vertical */}
          <div
            className="absolute"
            style={{
              [V]: 0,
              [H]: 0,
              width: THICK,
              height: ARM,
              background: SENT_CYAN,
              boxShadow: bloom,
            }}
          />
          {/* the riser: drops in from the end of the horizontal arm */}
          <div
            className="absolute"
            style={{
              [V]: 0,
              [H]: ARM,
              width: THIN,
              height: RISE,
              background: SENT_PALE,
              boxShadow: bloom,
            }}
          />
          {/* and the return, running on at the new depth */}
          <div
            className="absolute"
            style={{
              [V]: RISE,
              [H]: ARM,
              width: STEP,
              height: THIN,
              background: SENT_PALE,
              boxShadow: bloom,
            }}
          />
          {/* node at the elbow */}
          <div
            className="absolute"
            style={{
              [V]: `calc(${RISE} - ${NODE} / 2)`,
              [H]: `calc(${ARM} + ${STEP} - ${NODE} / 2)`,
              width: NODE,
              height: NODE,
              background: SENT_PALE,
              transform: "rotate(45deg)",
              boxShadow: bloom,
            }}
          />
        </div>
      );
    };

    /** Trapezoid tab pointing into the picture, on the two uprights. */
    const tab = (side: "left" | "right") => (
      <div
        key={`tab${side}`}
        className="absolute top-1/2 -translate-y-1/2"
        style={{
          [side]: 0,
          width: m.u(9, 1.8),
          height: m.u(34, 7),
          background: SENT_CYAN,
          clipPath:
            side === "left"
              ? "polygon(0 0,100% 22%,100% 78%,0 100%)"
              : "polygon(100% 0,0 22%,0 78%,100% 100%)",
          boxShadow: bloom,
        }}
      />
    );

    return (
      <>
        {bandBox(m, SENT_DARK)}
        <div className="absolute" style={m.opening}>
          {/* Edge runs, fading at both ends so they never butt into a corner. */}
          <div
            className="absolute"
            style={{
              top: 0,
              left: "22%",
              right: "22%",
              height: THIN,
              background: `linear-gradient(to right, transparent, ${SENT_CYAN} 18%, ${SENT_CYAN} 82%, transparent)`,
              boxShadow: bloom,
            }}
          />
          <div
            className="absolute"
            style={{
              bottom: 0,
              left: "22%",
              right: "22%",
              height: THIN,
              background: `linear-gradient(to right, transparent, ${SENT_CYAN} 18%, ${SENT_CYAN} 82%, transparent)`,
              boxShadow: bloom,
            }}
          />
          {(["left", "right"] as const).map((side) => (
            <div
              key={`v${side}`}
              className="absolute"
              style={{
                [side]: 0,
                top: "26%",
                bottom: "26%",
                width: THIN,
                background: `linear-gradient(to bottom, transparent, ${SENT_CYAN} 20%, ${SENT_CYAN} 80%, transparent)`,
                boxShadow: bloom,
              }}
            />
          ))}

          {/* A dim wash just inside the line, standing in for bloom on the feed. */}
          <div
            className="absolute inset-0"
            style={{ boxShadow: `inset 0 0 ${m.u(22, 4)} rgba(34,211,238,0.20)` }}
          />

          {ALL_CORNERS.map((k) => rig(k))}
          {(["left", "right"] as const).map((side) => tab(side))}

          {/* Ruler under the top run, offset to one side rather than centred. */}
          <div
            className="absolute"
            style={{
              top: m.u(8, 1.6),
              left: "30%",
              width: "22%",
              height: m.u(5, 1),
              backgroundImage: dashes("rgba(165,243,252,0.7)", THIN, m.u(8, 1.5)),
            }}
          />
        </div>

        {m.name &&
          plateBox(
            m,
            { padding: `0 ${m.p(22, 4.2)}` },
            <>
              <div
                className="absolute inset-0"
                style={{
                  background: SENT_DARK,
                  clipPath: `polygon(${m.p(12, 2.2)} 0, calc(100% - ${m.p(12, 2.2)}) 0, 100% 50%, calc(100% - ${m.p(
                    12,
                    2.2,
                  )}) 100%, ${m.p(12, 2.2)} 100%, 0 50%)`,
                }}
              />
              <div
                className="absolute inset-x-0 top-0"
                style={{ height: m.p(2, 0.3), background: SENT_CYAN, boxShadow: bloom }}
              />
              <div
                className="absolute inset-x-0 bottom-0"
                style={{ height: m.p(2, 0.3), background: SENT_CYAN, boxShadow: bloom }}
              />
              <span
                className="relative leading-none font-bold uppercase whitespace-nowrap"
                style={{
                  ...mono,
                  color: SENT_PALE,
                  fontSize: m.p(13, 2.3),
                  letterSpacing: m.p(4, 0.9),
                  textShadow: `0 0 ${m.p(6, 1.1)} ${SENT_HALO}`,
                }}
              >
                {m.name}
              </span>
            </>,
          )}
      </>
    );
  },
};

/* ---------------------------------------------------------- 4 · tactical */

/** Green phosphor gun-camera: scanlines, a ruler, corner reticles. */
const TAC_FRAME = "rgba(3,10,6,0.97)";
const TAC_GREEN = "#4ADE80";

const tactical: CamTheme = {
  label: "Tactical — green phosphor HUD",
  band: [14, 2.6],
  plate: [26, 4.4],
  Chrome: (m) => {
    const EDGE = m.u(2, 0.3);
    const ARM = m.u(30, 8);
    const RULE = m.u(7, 1.4);

    const reticle = (v: "top" | "bottom", h: "left" | "right") => (
      <div
        key={`${v}${h}`}
        className="absolute"
        style={{
          [v]: 0,
          [h]: 0,
          width: ARM,
          height: ARM,
          [`border${v === "top" ? "Top" : "Bottom"}Width`]: EDGE,
          [`border${h === "left" ? "Left" : "Right"}Width`]: EDGE,
          borderStyle: "solid",
          borderColor: TAC_GREEN,
        }}
      />
    );

    return (
      <>
        {bandBox(m, TAC_FRAME)}
        <div className="absolute" style={m.opening}>
          {scanlines("rgba(74,222,128,0.055)", m.u(3, 0.5))}
          <div
            className="absolute inset-0"
            style={{ borderWidth: EDGE, borderStyle: "solid", borderColor: "rgba(74,222,128,0.35)" }}
          />
          {(["top", "bottom"] as const).flatMap((v) =>
            (["left", "right"] as const).map((h) => reticle(v, h)),
          )}
          <div
            className="absolute left-1/4 right-1/4 top-0"
            style={{
              height: RULE,
              backgroundImage: dashes("rgba(74,222,128,0.65)", EDGE, m.u(9, 1.7)),
            }}
          />
          <div
            className="absolute top-1/2 left-0 -translate-y-1/2"
            style={{ width: m.u(10, 2.2), height: EDGE, background: TAC_GREEN }}
          />
          <div
            className="absolute top-1/2 right-0 -translate-y-1/2"
            style={{ width: m.u(10, 2.2), height: EDGE, background: TAC_GREEN }}
          />
        </div>

        {m.name &&
          plateBox(
            m,
            { padding: `0 ${m.p(16, 3.2)}`, gap: m.p(8, 1.4) },
            <>
              <div className="absolute inset-0" style={{ background: TAC_FRAME }} />
              <div
                className="absolute inset-0"
                style={{
                  borderWidth: m.p(2, 0.3),
                  borderStyle: "solid",
                  borderColor: "rgba(74,222,128,0.7)",
                }}
              />
              <div
                className="relative"
                style={{ width: m.p(7, 1.2), height: m.p(7, 1.2), background: TAC_GREEN }}
              />
              <span
                className="relative leading-none font-bold uppercase whitespace-nowrap"
                style={{
                  ...mono,
                  color: TAC_GREEN,
                  fontSize: m.p(13, 2.3),
                  letterSpacing: m.p(3, 0.7),
                }}
              >
                {m.name}
              </span>
            </>,
          )}
      </>
    );
  },
};

/* ----------------------------------------------------------- 5 · bastion */

/**
 * Armoured bulkhead: layered steel, hazard stripes, bolts and corner gussets.
 *
 * The only theme built as material rather than as light — two plate tones with a
 * bevel between them, so the band reads as thickness instead of as a painted
 * border, and the accents are warning markings rather than glow.
 */
const BAST_STEEL = "rgba(20,20,23,0.97)";
const BAST_PLATE = "rgba(46,48,55,0.97)";
const BAST_LIP = "rgba(150,155,168,0.9)";
const BAST_RED = "#E23B3B";
const BAST_BONE = "#D9D3C6";

const bastion: CamTheme = {
  label: "Bastion — armoured bulkhead, bolts and hazard stripes",
  band: [24, 4.4],
  plate: [30, 5.0],
  backdrop: "#0B0B0D",
  Chrome: (m) => {
    const LIP = m.u(2, 0.28);
    const GUSSET = m.u(34, 7.5);
    const BOLT = m.u(4, 0.75);
    const inner = m.u(9, 1.7); // depth of the lighter inner plate

    return (
      <>
        {bandBox(m, BAST_STEEL)}

        {/* The inner plate, a shade lighter, with a bright lip where the two
            meet — that step is what sells the band as having depth. */}
        <div
          className="absolute"
          style={{
            top: inner,
            left: inner,
            right: inner,
            bottom: `calc(${m.DROP} + ${inner})`,
            borderStyle: "solid",
            borderColor: BAST_PLATE,
            borderWidth: `calc(${m.BAND} - ${inner})`,
          }}
        />

        {/* Bolt rows down the two uprights. */}
        {(["left", "right"] as const).map((side) => (
          <div
            key={`bolts${side}`}
            className="absolute"
            style={{
              [side]: 0,
              top: GUSSET,
              bottom: `calc(${m.DROP} + ${GUSSET})`,
              width: inner,
              backgroundImage: `radial-gradient(circle, ${BAST_LIP} 0 26%, transparent 28%)`,
              backgroundSize: `100% ${m.u(22, 4)}`,
              backgroundRepeat: "repeat-y",
            }}
          />
        ))}

        {/* Hazard stripes let into the top rail, offset to one side. */}
        <div
          className="absolute"
          style={{
            top: inner,
            left: "16%",
            width: "30%",
            height: `calc(${m.BAND} - ${inner})`,
            backgroundImage: hazard(BAST_RED, "rgba(24,24,28,0.95)", m.u(9, 1.7)),
            outline: `${LIP} solid rgba(0,0,0,0.6)`,
          }}
        />
        {/* Bolt run along the top rail, on the other side of centre. */}
        <div
          className="absolute"
          style={{
            top: 0,
            right: GUSSET,
            width: "24%",
            height: inner,
            ...rivetRow(BAST_LIP, m.u(22, 4)),
          }}
        />

        <div className="absolute" style={m.opening}>
          {/* Corner gussets: a filled plate cut on the diagonal, two bolts each. */}
          {ALL_CORNERS.map((k) => (
            <div key={`g${k}`}>
              <div
                className="absolute"
                style={{
                  [vEdge(k)]: 0,
                  [hEdge(k)]: 0,
                  width: GUSSET,
                  height: GUSSET,
                  background: "rgba(74,77,86,0.97)",
                  clipPath: TRIANGLE[k],
                  outline: `${LIP} solid ${BAST_LIP}`,
                  outlineOffset: `-${LIP}`,
                }}
              />
              <div
                className="absolute rounded-full"
                style={{
                  [vEdge(k)]: `calc(${GUSSET} * 0.17)`,
                  [hEdge(k)]: `calc(${GUSSET} * 0.17)`,
                  width: BOLT,
                  height: BOLT,
                  background: BAST_LIP,
                }}
              />
              <div
                className="absolute rounded-full"
                style={{
                  [vEdge(k)]: `calc(${GUSSET} * 0.13)`,
                  [hEdge(k)]: `calc(${GUSSET} * 0.55)`,
                  width: BOLT,
                  height: BOLT,
                  background: BAST_LIP,
                }}
              />
            </div>
          ))}

          {/* The lip around the opening, plus a red rule along the bottom. */}
          <div
            className="absolute inset-0"
            style={{ borderWidth: LIP, borderStyle: "solid", borderColor: BAST_LIP }}
          />
          <div
            className="absolute inset-x-0 bottom-0"
            style={{ height: m.u(3, 0.5), background: BAST_RED, opacity: 0.9 }}
          />
        </div>

        {/* A bolted plate, riveted at both ends, stencilled. */}
        {m.name &&
          plateBox(
            m,
            { padding: `0 ${m.p(24, 4.4)}` },
            <>
              <div
                className="absolute inset-0"
                style={{
                  background: BAST_PLATE,
                  borderWidth: m.p(2, 0.3),
                  borderStyle: "solid",
                  borderColor: BAST_LIP,
                }}
              />
              <div
                className="absolute inset-x-0 bottom-0"
                style={{ height: m.p(2, 0.3), background: BAST_RED }}
              />
              {(["left", "right"] as const).map((side) => (
                <div
                  key={`pb${side}`}
                  className="absolute top-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    [side]: m.p(8, 1.5),
                    width: m.p(5, 0.9),
                    height: m.p(5, 0.9),
                    background: BAST_LIP,
                  }}
                />
              ))}
              <span
                className="relative leading-none font-bold uppercase whitespace-nowrap"
                style={{
                  ...geist,
                  color: BAST_BONE,
                  fontSize: m.p(14, 2.5),
                  letterSpacing: m.p(4, 0.85),
                }}
              >
                {m.name}
              </span>
            </>,
          )}
      </>
    );
  },
};

/* ---------------------------------------------------------- 6 · nostromo */

/**
 * 1979 amber CRT: rounded, rivets, dot-matrix lettering, scanlines.
 *
 * The opening is rounded but the band is not — `fillet` bridges the two. Before
 * that it was a `box-shadow` ring, which rounded the frame's *outer* corners and
 * so left four notches of bare camera at the corners of the source.
 */
const NOS_SHELL = "#0A0803";
const NOS_AMBER = "#FFB000";

const nostromo: CamTheme = {
  label: "Nostromo — amber CRT, rounded",
  band: [18, 3.2],
  plate: [28, 4.6],
  backdrop: "#0A0803",
  Chrome: (m) => {
    const R = m.u(14, 2.6);
    const EDGE = m.u(2, 0.3);
    const RIVET = m.u(5, 0.9);
    const off = `calc(${m.BAND} / 2)`;

    return (
      <>
        {bandBox(m, NOS_SHELL)}

        {ALL_CORNERS.map((k) => (
          <div
            key={k}
            className="absolute rounded-full"
            style={{
              [vEdge(k)]: k[0] === "t" ? off : `calc(${m.DROP} + ${off})`,
              [hEdge(k)]: off,
              width: RIVET,
              height: RIVET,
              // Centre on the offset, whichever pair of edges it is anchored to:
              // a right-anchored box has to move right to centre, not left.
              transform: `translate(${k[1] === "l" ? "-50%" : "50%"}, ${
                k[0] === "t" ? "-50%" : "50%"
              })`,
              background: NOS_AMBER,
              opacity: 0.55,
            }}
          />
        ))}
        <div
          className="absolute"
          style={{
            top: `calc(${off} - ${EDGE} / 2)`,
            left: "22%",
            right: "22%",
            height: EDGE,
            backgroundImage: dashes("rgba(255,176,0,0.5)", m.u(6, 1.1), m.u(12, 2.2)),
          }}
        />

        <div className="absolute" style={{ ...m.opening, borderRadius: R }}>
          {fillet(R, NOS_SHELL)}
          {scanlines("rgba(255,176,0,0.05)", m.u(3, 0.55), R)}
          <div
            className="absolute inset-0"
            style={{
              borderRadius: R,
              borderWidth: EDGE,
              borderStyle: "solid",
              borderColor: "rgba(255,176,0,0.6)",
            }}
          />
        </div>

        {m.name &&
          plateBox(
            m,
            { padding: `0 ${m.p(18, 3.4)}`, gap: m.p(8, 1.5) },
            <>
              <div
                className="absolute inset-0"
                style={{
                  background: NOS_SHELL,
                  borderRadius: m.p(6, 1.1),
                  borderWidth: m.p(2, 0.3),
                  borderStyle: "solid",
                  borderColor: NOS_AMBER,
                }}
              />
              <div
                className="relative"
                style={{ width: m.p(5, 0.9), height: m.p(5, 0.9), background: NOS_AMBER }}
              />
              <span
                className="relative leading-none font-bold uppercase whitespace-nowrap"
                style={{
                  ...mono,
                  color: NOS_AMBER,
                  fontSize: m.p(13, 2.3),
                  letterSpacing: m.p(4, 0.9),
                }}
              >
                {m.name}
              </span>
              <div
                className="relative"
                style={{ width: m.p(5, 0.9), height: m.p(5, 0.9), background: NOS_AMBER }}
              />
            </>,
          )}
      </>
    );
  },
};

/* ---------------------------------------------------------------- lookup */

/**
 * Order is the contract: `?theme=1` through `?theme=6` index this, so the
 * numbering in the docs stays put. Names work too and are the readable form.
 */
export const THEME_ORDER = ["nexus", "deco", "sentinel", "tactical", "bastion", "nostromo"] as const;

export type ThemeName = (typeof THEME_ORDER)[number];

export const THEMES: Record<ThemeName, CamTheme> = {
  nexus,
  deco,
  sentinel,
  tactical,
  bastion,
  nostromo,
};

/** Accepts a name or a 1-based index; anything else falls back to nexus. */
export function resolveTheme(raw: string): ThemeName {
  const key = raw.trim().toLowerCase();
  if ((THEME_ORDER as readonly string[]).includes(key)) return key as ThemeName;
  const n = Number(key);
  if (Number.isInteger(n) && n >= 1 && n <= THEME_ORDER.length) return THEME_ORDER[n - 1];
  return "nexus";
}
