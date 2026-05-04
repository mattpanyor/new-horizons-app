import { notFound } from "next/navigation";
import Link from "next/link";
import { getSectorSlugs, getSectorBySlug } from "@/lib/sectors";
import { getStarSystemBySlug } from "@/lib/starsystems";
import { getKankaUrlMap } from "@/lib/db/kankaEntities";
import type { StarSystemMetadata } from "@/types/starsystem";
import StarSystemBackground from "@/components/StarSystemBackground";
import SectorMap from "@/components/SectorMap";
import { SectorMapNebula } from "@/components/sectormap/SectorMapNebula";
import { SectorMapGrid } from "@/components/sectormap/SectorMapGrid";
import { SectorMapSvgLayer } from "@/components/sectormap/SectorMapSvgLayer";

export async function generateStaticParams() {
  const slugs = getSectorSlugs();
  return slugs.map((slug) => ({ slug }));
}

export default async function SectorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const slugs = getSectorSlugs();

  if (!slugs.includes(slug)) {
    notFound();
  }

  const sector = getSectorBySlug(slug);

  if (sector.published === false) {
    notFound();
  }

  // Load full star system data for every pin in this sector (server-side)
  const systemsData: Record<string, StarSystemMetadata> = {};
  for (const pin of sector.systems) {
    try {
      systemsData[pin.slug] = getStarSystemBySlug(slug, pin.slug);
    } catch {
      // Star system JSON not found — pin will still appear on the map, just won't be expandable
    }
  }

  // Enrich with Kanka URLs by name-matching entities from DB
  const kankaMap = await getKankaUrlMap();
  if (kankaMap.size > 0) {
    for (const sys of Object.values(systemsData)) {
      if (!sys.kankaUrl) sys.kankaUrl = kankaMap.get(sys.name.toLowerCase());
      if (!sys.star.kankaUrl) sys.star.kankaUrl = kankaMap.get(sys.star.name.toLowerCase());
      for (const body of sys.bodies) {
        if (!body.kankaUrl) body.kankaUrl = kankaMap.get(body.name.toLowerCase());
      }
    }
    for (const marker of sector.markers ?? []) {
      if (!marker.kankaUrl) marker.kankaUrl = kankaMap.get(marker.name.toLowerCase());
    }
    for (const conn of sector.connections ?? []) {
      if (conn.marker && !conn.marker.kankaUrl) {
        conn.marker.kankaUrl = kankaMap.get(conn.marker.name.toLowerCase());
      }
    }
  }

  return (
    <>
      <StarSystemBackground />
      <div className="h-[calc(100dvh-4rem)] flex flex-col overflow-hidden px-4 py-4">
        {/* Back button */}
        <div className="mb-2 shrink-0">
          <Link
            href="/sectors"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
            style={{ fontFamily: "var(--font-cinzel), serif" }}
          >
            <span>&#x2190;</span>
            <span>Galactic Map</span>
          </Link>
        </div>

        <div className="flex-1 min-h-0">
          <SectorMap
            sector={sector}
            systemsData={systemsData}
            staticSvgLayers={
              <SectorMapSvgLayer sector={sector} systemsData={systemsData} />
            }
          >
            <SectorMapNebula nebulaColor={sector.nebulaColor ?? sector.color} sectorColor={sector.color} />
            <SectorMapGrid />
          </SectorMap>
        </div>
      </div>
    </>
  );
}
