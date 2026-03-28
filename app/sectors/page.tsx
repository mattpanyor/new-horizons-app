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
          {/* Sun + concentric orbit rings — top right */}
          <circle cx="74" cy="20" r="5" fill="currentColor" fillOpacity="0.35" stroke="none" />
          <circle cx="74" cy="20" r="2.5" fill="currentColor" fillOpacity="0.6" stroke="none" />
          <circle cx="74" cy="20" r="12" strokeWidth="0.5" strokeOpacity="0.25" strokeDasharray="1.5 3" />
          <circle cx="74" cy="20" r="22" strokeWidth="0.45" strokeOpacity="0.18" strokeDasharray="1.5 4" />
          <circle cx="74" cy="20" r="34" strokeWidth="0.4" strokeOpacity="0.12" strokeDasharray="1.5 5" />
          {/* Ley lines — flowing from right, curving around the nose */}
          {/* Lines arriving from ahead, deflecting upward around hull */}
          <path d="M92 48 Q78 48, 66 44 Q62 42, 56 36" strokeWidth="0.7" strokeOpacity="0.3" fill="none" />
          <path d="M94 46 Q80 46, 68 40 Q62 36, 56 28" strokeWidth="0.5" strokeOpacity="0.2" fill="none" />
          <path d="M90 48 Q76 47, 66 44 Q62 42, 58 38" strokeWidth="0.6" strokeOpacity="0.25" fill="none" />
          <path d="M96 44 Q82 44, 70 36 Q64 30, 58 22" strokeWidth="0.4" strokeOpacity="0.15" fill="none" />
          {/* Lines arriving from ahead, deflecting downward around hull */}
          <path d="M92 48 Q78 48, 66 52 Q62 54, 56 60" strokeWidth="0.7" strokeOpacity="0.3" fill="none" />
          <path d="M94 50 Q80 50, 68 56 Q62 60, 56 68" strokeWidth="0.5" strokeOpacity="0.2" fill="none" />
          <path d="M90 48 Q76 49, 66 52 Q62 54, 58 58" strokeWidth="0.6" strokeOpacity="0.25" fill="none" />
          <path d="M96 52 Q82 52, 70 60 Q64 66, 58 74" strokeWidth="0.4" strokeOpacity="0.15" fill="none" />
          {/* Ship — top-down view, nose pointing right, symmetrical */}
          <g transform="translate(38,48) scale(0.7) translate(-48,-48)">
          {/* Main hull — central spine, wide at rear tapering to sharp nose */}
          <path
            d="M10 43
             L22 40
             L40 39
             L58 40
             L72 44
             C80 44, 84 46, 84 48
             C84 50, 80 52, 72 52
             L58 56
             L40 57
             L22 56
             L10 53
             Z"
            strokeWidth="1.1" strokeOpacity="0.7" fill="currentColor" fillOpacity="0.06"
          />
          {/* Centre spine ridge */}
          <line x1="10" y1="48" x2="82" y2="48" strokeWidth="0.9" strokeOpacity="0.6" />
          {/* Upper wing — curved triangle swept back */}
          <path
            d="M40 39
             C36 42, 22 30, 18 26
             C20 28, 22 36, 24 39"
            strokeWidth="0.9" strokeOpacity="0.6" fill="currentColor" fillOpacity="0.05"
          />
          {/* Lower wing — curved triangle swept back, mirror */}
          <path
            d="M40 57
             C36 54, 22 66, 18 70
             C20 68, 22 60, 24 57"
            strokeWidth="0.9" strokeOpacity="0.6" fill="currentColor" fillOpacity="0.05"
          />
          {/* Engine block — cylindrical rear, top-down shows as wide bar */}
          <path d="M10 40 Q6 42, 6 48 Q6 54, 10 56" strokeWidth="1" strokeOpacity="0.55" fill="currentColor" fillOpacity="0.08" />
          {/* Engine exhaust */}
          <line x1="6" y1="43" x2="-4" y2="43" strokeWidth="0.7" strokeOpacity="0.5" />
          <line x1="5" y1="48" x2="-6" y2="48" strokeWidth="0.8" strokeOpacity="0.55" />
          <line x1="6" y1="53" x2="-4" y2="53" strokeWidth="0.7" strokeOpacity="0.5" />
          {/* Cockpit canopy — teardrop shape near nose, top-down */}
          <path
            d="M70 45
             Q72 44, 76 44
             Q79 44, 80 48
             Q79 52, 76 52
             Q72 52, 70 51
             Z"
            strokeWidth="0.6" strokeOpacity="0.5" fill="currentColor" fillOpacity="0.1"
          />
          {/* Canopy frame lines */}
          <line x1="73" y1="44.5" x2="72" y2="51.5" strokeWidth="0.35" strokeOpacity="0.3" />
          <line x1="76" y1="44" x2="76" y2="52" strokeWidth="0.35" strokeOpacity="0.25" />
          {/* Canopy glint */}
          <ellipse cx="77" cy="47" rx="1.2" ry="0.8" fill="currentColor" fillOpacity="0.25" stroke="none" />
          {/* Hull panel lines */}
          <line x1="36" y1="38" x2="36" y2="58" strokeWidth="0.3" strokeOpacity="0.12" />
          <line x1="52" y1="38" x2="52" y2="58" strokeWidth="0.3" strokeOpacity="0.1" />
          </g>
          {/* Planet horizon — wide arc at bottom */}
          <path
            d="M-10 96 Q48 72, 106 96"
            strokeWidth="1" strokeOpacity="0.3" fill="currentColor" fillOpacity="0.04"
          />
          <path
            d="M-10 96 Q48 78, 106 96"
            strokeWidth="0.5" strokeOpacity="0.15" fill="none"
          />
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
