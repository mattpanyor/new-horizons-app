// Server Component — static nebula background for SectorMap.
// No "use client" directive.

interface SectorMapNebulaProps {
  nebulaColor: string;
  sectorColor: string;
}

export function SectorMapNebula({ nebulaColor, sectorColor }: SectorMapNebulaProps) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: [
          `radial-gradient(ellipse 70% 60% at 38% 38%, ${nebulaColor}2e 0%, transparent 100%)`,
          `radial-gradient(ellipse 55% 50% at 68% 65%, ${nebulaColor}1e 0%, transparent 100%)`,
          `radial-gradient(ellipse 45% 40% at 18% 72%, ${sectorColor}14 0%, transparent 100%)`,
          "#030712",
        ].join(", "),
      }}
    />
  );
}
