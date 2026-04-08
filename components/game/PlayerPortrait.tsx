"use client";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

interface PlayerPortraitProps {
  name: string | null;
  title: string | null;
  imageUrl: string | null;
  group?: string | null;
  side: "player" | "opponent";
}

export default function PlayerPortrait({ name, title, imageUrl, group, side }: PlayerPortraitProps) {
  const isPlayer = side === "player";
  const accentColor = isPlayer ? "rgba(212, 175, 55, 0.4)" : "rgba(139, 92, 246, 0.4)";
  const borderColor = isPlayer ? "border-amber-400/30" : "border-purple-400/30";
  const textColor = isPlayer ? "text-amber-300/60" : "text-purple-300/60";
  const subtitleColor = isPlayer ? "text-amber-300/30" : "text-purple-300/30";

  return (
    <div className="hidden lg:flex flex-col items-center w-44">
      {/* Image is the anchor — centered by the parent flex items-center */}
      <div className={`relative w-36 aspect-[2/3] rounded border ${borderColor} overflow-hidden`}>
        {/* Corner brackets */}
        <div className={`absolute top-0 left-0 w-3 h-3 border-t border-l ${borderColor}`} />
        <div className={`absolute top-0 right-0 w-3 h-3 border-t border-r ${borderColor}`} />
        <div className={`absolute bottom-0 left-0 w-3 h-3 border-b border-l ${borderColor}`} />
        <div className={`absolute bottom-0 right-0 w-3 h-3 border-b border-r ${borderColor}`} />

        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name ?? ""}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white/[0.02]">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ color: accentColor }}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        )}

        {/* Subtle glow at bottom */}
        <div
          className="absolute bottom-0 inset-x-0 h-8"
          style={{ background: `linear-gradient(to top, ${accentColor}, transparent)` }}
        />
      </div>

      {/* Text stacks below the image — doesn't affect centering */}
      {name && (
        <div className="text-center mt-3 whitespace-nowrap">
          <p className={`text-xs tracking-[0.15em] uppercase ${textColor}`} style={cinzel}>
            {name}
          </p>
          {title && (
            <p className={`text-[10px] tracking-[0.1em] uppercase mt-1 ${subtitleColor}`} style={cinzel}>
              {title}
            </p>
          )}
          {group && (
            <p className={`text-[9px] tracking-[0.1em] uppercase mt-0.5 ${subtitleColor}`} style={cinzel}>
              {group}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
