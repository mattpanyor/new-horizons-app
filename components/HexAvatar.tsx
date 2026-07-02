"use client";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

// Pointy-top hexagon inscribed in a 1:1 square. Used for avatar tiles.
export const HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

// Tactical-frame hex avatar. Matches the project's existing decoration motif
// (corner brackets + thin accent strokes) seen on game boards and panels.
export function HexAvatar({
  imageUrl,
  letter,
  interactive,
  maxWidth = 96,
  letterClassName = "text-2xl",
}: {
  imageUrl: string | null;
  letter: string;
  interactive: boolean;
  /** Max rendered width in px; the tile is always square. */
  maxWidth?: number;
  /** Tailwind size class for the fallback letter. */
  letterClassName?: string;
}) {
  const stroke = interactive
    ? "border-indigo-500/30 group-hover:border-indigo-400/80"
    : "border-indigo-500/50";
  const fill = interactive
    ? "bg-indigo-500/30 group-hover:bg-indigo-400/80"
    : "bg-indigo-500/50";
  const glow = interactive
    ? "shadow-[0_0_0_rgba(99,102,241,0)] group-hover:shadow-[0_0_18px_rgba(99,102,241,0.35)]"
    : "shadow-[0_0_18px_rgba(99,102,241,0.2)]";

  return (
    <div className="relative w-full aspect-square mx-auto" style={{ maxWidth }}>
      {/* Corner brackets */}
      <div className={`absolute top-0 left-0 w-3 h-3 border-t border-l ${stroke} transition-colors`} />
      <div className={`absolute top-0 right-0 w-3 h-3 border-t border-r ${stroke} transition-colors`} />
      <div className={`absolute bottom-0 left-0 w-3 h-3 border-b border-l ${stroke} transition-colors`} />
      <div className={`absolute bottom-0 right-0 w-3 h-3 border-b border-r ${stroke} transition-colors`} />

      {/* Side connection ports */}
      <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-2 h-px ${fill} transition-colors`} />
      <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-2 h-px ${fill} transition-colors`} />

      {/* Vertex caps (top & bottom of hex) */}
      <div className={`absolute top-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rotate-45 ${fill} transition-colors`} />
      <div className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rotate-45 ${fill} transition-colors`} />

      {/* Hex tile */}
      <div
        className={`absolute inset-2 p-[2px] ${fill} ${glow} transition-all`}
        style={{ clipPath: HEX_CLIP }}
      >
        <div
          className="w-full h-full bg-slate-900/80 flex items-center justify-center overflow-hidden"
          style={{ clipPath: HEX_CLIP }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="w-full h-full object-cover object-top" />
          ) : (
            <span className={`${letterClassName} text-slate-500 uppercase`} style={cinzel}>
              {letter}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
