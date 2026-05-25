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

  // Load full star system data for every pin in this sector (server-side).
  // Done in parallel via Promise.all — the previous serial loop was the
  // single biggest source of page latency (4 DB round-trips per system,
  // sequential across N systems). Errors are logged so unexpected DB outages
  // don't masquerade as "system not found".
  const systemsData: Record<string, StarSystemMetadata> = {};
  const systemResults = await Promise.all(
    sector.systems.map(async (pin) => {
      try {
        return [pin.slug, await getStarSystemBySlug(slug, pin.slug)] as const;
      } catch (err) {
        console.warn(`[sectors/${slug}] failed to load system '${pin.slug}':`, err);
        return [pin.slug, null] as const;
      }
    })
  );
  for (const [pinSlug, sys] of systemResults) {
    if (sys) systemsData[pinSlug] = sys;
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

  // Enrich with Kanka URLs by name-matching entities from DB.
  // Skip the query entirely when every loaded entity already has externalUrl
  // (cheap fast-path for static sectors that don't rely on Kanka sync).
  const needsKankaLookup = Object.values(systemsData).some((sys) => {
    if (!sys.externalUrl) return true;
    if (!sys.star.externalUrl) return true;
    return sys.bodies.some((b) => !b.externalUrl);
  }) || (sector.markers ?? []).some((m) => !m.externalUrl)
    || (sector.connections ?? []).some((c) => c.marker && !c.marker.externalUrl);
  const kankaMap = needsKankaLookup ? await getKankaUrlMap() : new Map<string, string>();
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
