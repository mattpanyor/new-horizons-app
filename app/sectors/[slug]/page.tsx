import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { getSectorSlugs, getSectorBySlug } from "@/lib/sectors";
import { getStarSystemBySlug } from "@/lib/starsystems";
import { getKankaUrlMap } from "@/lib/db/kankaEntities";
import { getUserByUsername } from "@/lib/db/users";
import { getAllBiomes } from "@/lib/db/biomes";
import type { StarSystemMetadata } from "@/types/starsystem";
import StarSystemBackground from "@/components/StarSystemBackground";
import SectorMap from "@/components/SectorMap";
import { SectorMapNebula } from "@/components/sectormap/SectorMapNebula";
import { SectorMapGrid } from "@/components/sectormap/SectorMapGrid";
import { SectorMapSvgLayer } from "@/components/sectormap/SectorMapSvgLayer";

export async function generateStaticParams() {
  const slugs = await getSectorSlugs();
  return slugs.map((slug) => ({ slug }));
}

export default async function SectorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const slugs = await getSectorSlugs();

  if (!slugs.includes(slug)) {
    notFound();
  }

  const sector = await getSectorBySlug(slug);

  if (sector.published === false) {
    notFound();
  }

  // Load full star system data for every pin in this sector (server-side)
  const systemsData: Record<string, StarSystemMetadata> = {};
  for (const pin of sector.systems) {
    try {
      systemsData[pin.slug] = await getStarSystemBySlug(slug, pin.slug);
    } catch {
      // Star system not found — pin will still appear on the map, just won't be expandable
    }
  }

  // Read the current user for the edit-mode gate. Page is already dynamic
  // (DB-backed loader), so reading cookies doesn't cost static generation.
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  const user = username ? await getUserByUsername(username) : null;
  const userAccessLevel = user?.accessLevel ?? 0;

  // Biomes for the system-edit modal's dropdown. Cheap query; only used by
  // superadmins, but rendered statically with the page so the client doesn't
  // need a separate fetch.
  const biomes = userAccessLevel >= 127 ? await getAllBiomes() : [];

  // Enrich with Kanka URLs by name-matching entities from DB
  const kankaMap = await getKankaUrlMap();
  if (kankaMap.size > 0) {
    for (const sys of Object.values(systemsData)) {
      if (!sys.externalUrl) sys.externalUrl = kankaMap.get(sys.name.toLowerCase());
      if (!sys.star.externalUrl) sys.star.externalUrl = kankaMap.get(sys.star.name.toLowerCase());
      for (const body of sys.bodies) {
        if (!body.externalUrl) body.externalUrl = kankaMap.get(body.name.toLowerCase());
      }
    }
    for (const marker of sector.markers ?? []) {
      if (!marker.externalUrl) marker.externalUrl = kankaMap.get(marker.name.toLowerCase());
    }
    for (const conn of sector.connections ?? []) {
      if (conn.marker && !conn.marker.externalUrl) {
        conn.marker.externalUrl = kankaMap.get(conn.marker.name.toLowerCase());
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
            userAccessLevel={userAccessLevel}
            biomes={biomes}
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
