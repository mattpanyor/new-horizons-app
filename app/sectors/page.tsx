import { getAllSectors } from "@/lib/sectors";
import StarSystemBackground from "@/components/StarSystemBackground";
import GalacticMap from "@/components/GalacticMap";
import { GalacticMapBackground } from "@/components/galacticmap/GalacticMapBackground";
import PresenceCard from "@/components/PresenceCard";
import NavIcon from "@/components/NavIcon";

export default function SectorsPage() {
  const sectors = getAllSectors();
  const coreSector = sectors.find((s) => s.slug === "core");
  const outerSectors = sectors.filter((s) => s.slug !== "core");

  return (
    <>
      <StarSystemBackground />
      <NavIcon href="/ship" label="Ship">
        <svg width="64" height="64" viewBox="0 0 96 96" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          {/* Hexagonal schematic frame */}
          <polygon points="48,4 84,26 84,70 48,92 12,70 12,26" strokeWidth="0.5" strokeOpacity="0.15" />
          <polygon points="48,12 76,30 76,66 48,84 20,66 20,30" strokeWidth="0.4" strokeOpacity="0.1" />
          {/* Crosshair lines */}
          <line x1="48" y1="14" x2="48" y2="82" strokeWidth="0.3" strokeOpacity="0.1" />
          <line x1="18" y1="48" x2="78" y2="48" strokeWidth="0.3" strokeOpacity="0.1" />
          {/* Ship side profile — nose right, engines left */}
          <path
            d="M16 48
             L22 44 L32 42 L44 40 L58 38 L68 36
             Q76 34, 82 38
             L84 42
             Q85 46, 82 48"
            strokeWidth="1" strokeOpacity="0.7"
          />
          <path
            d="M82 48
             Q85 50, 84 54
             L82 58
             Q76 62, 68 60
             L58 58 L44 56 L32 54 L22 52
             L16 48Z"
            strokeWidth="1" strokeOpacity="0.7" fill="currentColor" fillOpacity="0.04"
          />
          {/* Upper fin / command tower */}
          <path d="M52 40 L56 28 Q58 24, 62 26 L60 36" strokeWidth="0.8" strokeOpacity="0.6" />
          <path d="M56 28 L58 30" strokeWidth="0.4" strokeOpacity="0.3" />
          {/* Lower fin */}
          <path d="M50 56 L54 66 Q56 70, 52 70 L48 60" strokeWidth="0.8" strokeOpacity="0.5" />
          {/* Engine block */}
          <rect x="12" y="44" width="8" height="8" rx="1" strokeWidth="0.6" strokeOpacity="0.5" fill="currentColor" fillOpacity="0.06" />
          <line x1="12" y1="46" x2="8" y2="45" strokeWidth="0.5" strokeOpacity="0.3" />
          <line x1="12" y1="48" x2="6" y2="48" strokeWidth="0.5" strokeOpacity="0.3" />
          <line x1="12" y1="50" x2="8" y2="51" strokeWidth="0.5" strokeOpacity="0.3" />
          {/* Cockpit window */}
          <ellipse cx="78" cy="44" rx="3" ry="2" strokeWidth="0.6" strokeOpacity="0.5" fill="currentColor" fillOpacity="0.12" />
          {/* Hull details */}
          <line x1="30" y1="43" x2="30" y2="53" strokeWidth="0.3" strokeOpacity="0.2" />
          <line x1="42" y1="41" x2="42" y2="55" strokeWidth="0.3" strokeOpacity="0.2" />
          <line x1="56" y1="39" x2="56" y2="57" strokeWidth="0.3" strokeOpacity="0.2" />
          <circle cx="36" cy="48" r="1.5" strokeWidth="0.4" strokeOpacity="0.2" />
          <circle cx="50" cy="48" r="1.5" strokeWidth="0.4" strokeOpacity="0.2" />
          {/* Corner tick marks */}
          <path d="M22 16 L22 20 M22 16 L26 16" strokeWidth="0.4" strokeOpacity="0.25" />
          <path d="M74 16 L74 20 M74 16 L70 16" strokeWidth="0.4" strokeOpacity="0.25" />
          <path d="M22 80 L22 76 M22 80 L26 80" strokeWidth="0.4" strokeOpacity="0.25" />
          <path d="M74 80 L74 76 M74 80 L70 80" strokeWidth="0.4" strokeOpacity="0.25" />
        </svg>
      </NavIcon>
      <div className="h-[calc(100dvh-4rem)] flex flex-col items-center justify-center gap-5 px-4">
        <p
          className="text-[11px] tracking-[0.45em] text-white/30 uppercase select-none"
          style={{ fontFamily: "var(--font-cinzel), serif" }}
        >
          Galactic Sectors
        </p>
        <GalacticMap sectors={sectors}>
          <GalacticMapBackground coreSector={coreSector} outerSectors={outerSectors} />
        </GalacticMap>
      </div>
      <PresenceCard position="Galactic Map" />
    </>
  );
}
