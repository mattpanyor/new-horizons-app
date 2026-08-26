import type { FactionCategory } from "@/lib/allegiances";

// The face a section wears while it is closed.
//
// Drawn rather than uploaded: each cover is the section's own subject in the
// card's deco language — hairline strokes, chamfers, lozenges — so a closed
// panel reads as part of the same board as the cards it hides. One portrait
// viewBox each, sliced, so a cover fills a third of the width or a sliver
// without redrawing.
//
// Fitted rather than sliced: these are one composition each, and a cover
// with its foot cut off reads as a mistake rather than as a crop.
//
// The three are deliberately not the same picture in three colours. The
// Imperium is drawn symmetrical and rising; the Houses are heraldry, quartered
// and balanced; what is outside is neither — its geometry does not resolve.

const VB = "0 0 200 280";

/**
 * Rounded to two places, and that is load-bearing rather than tidiness.
 *
 * Math.sin and Math.cos are allowed to differ in the last bit between engines,
 * and the server renders this in Node while the browser re-renders it in
 * Chrome. An unrounded coordinate serialises as 49.72492184598873 on one side
 * and ...74 on the other, which React reports as a hydration mismatch.
 */
const r2 = (n: number) => Math.round(n * 100) / 100;

/** The Imperium: a sun over a stepped colonnade, strictly symmetrical. */
function ImperialCover({ accent }: { accent: string }) {
  const rays = Array.from({ length: 17 }, (_, i) => {
    const deg = -96 + i * 12;
    const rad = (deg * Math.PI) / 180;
    return {
      x1: r2(100 + Math.sin(rad) * 26),
      y1: r2(104 - Math.cos(rad) * 26),
      x2: r2(100 + Math.sin(rad) * 92),
      y2: r2(104 - Math.cos(rad) * 92),
    };
  });

  return (
    <svg viewBox={VB} preserveAspectRatio="xMidYMid meet" fill="none" className="h-full w-full">
      <g stroke={accent}>
        {rays.map((r, i) => (
          <line key={i} {...r} strokeWidth={i % 2 ? 0.6 : 1.1} opacity={i % 2 ? 0.2 : 0.34} />
        ))}
        <circle cx="100" cy="104" r="22" strokeWidth="1.4" opacity="0.6" />
        <circle cx="100" cy="104" r="15" strokeWidth="0.7" opacity="0.4" />

        {/* Colonnade, stepping up to the centre */}
        {[
          [44, 96], [60, 84], [76, 74], [124, 74], [140, 84], [156, 96],
        ].map(([x, top], i) => (
          <g key={`c${i}`} opacity="0.4">
            <path d={`M${x - 7} 210 V${top + 12} L${x} ${top} L${x + 7} ${top + 12} V210`} strokeWidth="0.9" />
            <line x1={x} y1={top + 16} x2={x} y2="206" strokeWidth="0.5" opacity="0.6" />
          </g>
        ))}

        {/* Stepped plinth */}
        <path d="M26 212 H174 M34 220 H166 M42 228 H158 M50 236 H150" strokeWidth="1" opacity="0.45" />
        <path d="M100 244 l7 7 -7 7 -7 -7 Z" strokeWidth="1" opacity="0.6" />
      </g>
    </svg>
  );
}

/** The Houses: a quartered escutcheon under a coronet of lozenges. */
function NobilityCover({ accent }: { accent: string }) {
  const shield = "M56 74 H144 V150 C144 190 122 210 100 222 C78 210 56 190 56 150 Z";

  return (
    <svg viewBox={VB} preserveAspectRatio="xMidYMid meet" fill="none" className="h-full w-full">
      <g stroke={accent}>
        {/* Coronet */}
        <path d="M62 60 H138" strokeWidth="1.2" opacity="0.5" />
        {[70, 85, 100, 115, 130].map((x, i) => (
          <path
            key={x}
            d={`M${x} ${i % 2 ? 46 : 38} l6 6 -6 6 -6 -6 Z`}
            strokeWidth="0.9"
            opacity={i % 2 ? 0.35 : 0.55}
          />
        ))}
        <path d="M62 60 L70 48 M138 60 L130 48 M100 60 V44" strokeWidth="0.6" opacity="0.35" />

        {/* Escutcheon, quartered */}
        <path d={shield} strokeWidth="1.4" opacity="0.6" />
        <path d="M100 74 V222 M56 148 H144" strokeWidth="0.7" opacity="0.4" />
        <path d="M100 132 l14 16 -14 16 -14 -16 Z" strokeWidth="1" opacity="0.55" />

        {/* Laurel, one arc each side */}
        <path d="M42 120 C30 152 34 186 52 210" strokeWidth="0.8" opacity="0.35" />
        <path d="M158 120 C170 152 166 186 148 210" strokeWidth="0.8" opacity="0.35" />
        {[132, 150, 168, 186].map((y, i) => (
          <g key={y} opacity="0.3">
            <path d={`M${39 - i} ${y} l-9 -5 9 -5`} strokeWidth="0.6" />
            <path d={`M${161 + i} ${y} l9 -5 -9 -5`} strokeWidth="0.6" />
          </g>
        ))}
      </g>
    </svg>
  );
}

/** What is outside: a broken ring, off-centre, with nothing lining up. */
function ExternalCover({ accent }: { accent: string }) {
  // Deliberately irregular: the angles are uneven and the lengths do not repeat,
  // so the eye finds no order in it — the opposite of the other two covers.
  const shards = [
    [-160, 40], [-124, 74], [-96, 52], [-58, 88], [-24, 46],
    [12, 80], [44, 58], [86, 92], [118, 50], [152, 78],
  ] as const;

  return (
    <svg viewBox={VB} preserveAspectRatio="xMidYMid meet" fill="none" className="h-full w-full">
      <g stroke={accent}>
        {/* A ring that does not close */}
        <path
          d="M112 66 A62 62 0 1 1 60 152"
          strokeWidth="1.5"
          opacity="0.55"
          strokeLinecap="round"
        />
        <path d="M74 178 A62 62 0 0 0 92 194" strokeWidth="1.5" opacity="0.4" strokeLinecap="round" />
        <path
          d="M118 78 A50 50 0 1 0 148 168"
          strokeWidth="0.7"
          opacity="0.3"
          strokeDasharray="7 13"
        />

        {shards.map(([deg, len], i) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <line
              key={i}
              x1={r2(104 + Math.sin(rad) * 64)}
              y1={r2(140 - Math.cos(rad) * 64)}
              x2={r2(104 + Math.sin(rad) * (64 + len))}
              y2={r2(140 - Math.cos(rad) * (64 + len))}
              strokeWidth={i % 3 ? 0.6 : 1}
              opacity={i % 3 ? 0.22 : 0.4}
            />
          );
        })}

        {/* Something watching from inside it */}
        <path d="M104 140 m-17 0 a17 12 0 1 0 34 0 a17 12 0 1 0 -34 0" strokeWidth="1.1" opacity="0.6" />
        <path d="M104 140 m-5 0 a5 8 0 1 0 10 0 a5 8 0 1 0 -10 0" strokeWidth="1.3" opacity="0.75" />

        {/* Scatter, on no grid at all */}
        {[[38, 62], [166, 44], [28, 214], [176, 198], [148, 246], [56, 258]].map(([x, y], i) => (
          <path key={i} d={`M${x} ${y} l4 4 -4 4 -4 -4 Z`} strokeWidth="0.7" opacity="0.3" />
        ))}
      </g>
    </svg>
  );
}

export default function CategoryCover({
  category,
  accent,
}: {
  category: FactionCategory;
  accent: string;
}) {
  if (category === "imperial") return <ImperialCover accent={accent} />;
  if (category === "nobility") return <NobilityCover accent={accent} />;
  return <ExternalCover accent={accent} />;
}
