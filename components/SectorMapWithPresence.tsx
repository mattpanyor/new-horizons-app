"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import SectorMap from "@/components/SectorMap";
import PresenceCard from "@/components/PresenceCard";
import type { SectorMetadata } from "@/types/sector";
import type { StarSystemMetadata } from "@/types/starsystem";

interface Props {
  sector: SectorMetadata;
  systemsData: Record<string, StarSystemMetadata>;
  children?: React.ReactNode;
  staticSvgLayers: React.ReactNode;
}

export default function SectorMapWithPresence({ sector, systemsData, children, staticSvgLayers }: Props) {
  const [activeSystemSlug, setActiveSystemSlug] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const systemName = activeSystemSlug
    ? (systemsData[activeSystemSlug]?.name ?? activeSystemSlug)
    : null;

  const position = systemName
    ? `${systemName} · ${sector.name}`
    : sector.name;

  return (
    <>
      <SectorMap
        sector={sector}
        systemsData={systemsData}
        onSystemChange={setActiveSystemSlug}
        staticSvgLayers={staticSvgLayers}
      >
        {children}
      </SectorMap>
      {mounted && createPortal(<PresenceCard position={position} />, document.body)}
    </>
  );
}
