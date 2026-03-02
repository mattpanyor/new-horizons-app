import { getAllSectors } from "@/lib/sectors";
import StarSystemBackground from "@/components/StarSystemBackground";
import GalacticMap from "@/components/GalacticMap";
import { GalacticMapBackground } from "@/components/galacticmap/GalacticMapBackground";
import PresenceCard from "@/components/PresenceCard";

export default function SectorsPage() {
  const sectors = getAllSectors();
  const coreSector = sectors.find((s) => s.slug === "core");
  const outerSectors = sectors.filter((s) => s.slug !== "core");

  return (
    <>
      <StarSystemBackground />
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
