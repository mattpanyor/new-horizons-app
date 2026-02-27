import { notFound } from "next/navigation";
import Link from "next/link";
import { getSectorSlugs, getSectorBySlug } from "@/lib/sectors";
import { getStarSystemBySlug } from "@/lib/starsystems";
import type { StarSystemMetadata } from "@/types/starsystem";
import StarSystemBackground from "@/components/StarSystemBackground";
import SectorMapWithPresence from "@/components/SectorMapWithPresence";

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

  return (
    <>
      <StarSystemBackground />
      <div className="h-[calc(100dvh-4rem)] flex flex-col overflow-hidden px-4 pt-4">
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
          <SectorMapWithPresence sector={sector} systemsData={systemsData} />
        </div>
      </div>
    </>
  );
}
