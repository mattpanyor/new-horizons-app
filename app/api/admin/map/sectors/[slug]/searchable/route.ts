// Searchable endpoint — returns all sluggable entities (systems, vortexes,
// markers) for a sector. Used by the editor's connection picker so the GM can
// pick A/B endpoints from a single autocomplete. See map-migration.md §6.2.
//
// Auth: superadmin only.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByUsername } from "@/lib/db/users";
import { getSectorRowBySlug } from "@/lib/db/sectors";
import { getSystemsBySector } from "@/lib/db/systems";
import { getVortexesBySector } from "@/lib/db/vortexes";
import { getMarkersBySector } from "@/lib/db/markers";

async function requireSuperAdmin() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) return null;
  const user = await getUserByUsername(username);
  if (!user || user.accessLevel < 127) return null;
  return user;
}

export interface SearchableEndpoint {
  slug: string;
  name: string;
  kind: "system" | "vortex" | "marker";
  id: number;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const admin = await requireSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;
  const sector = await getSectorRowBySlug(slug);
  if (!sector) {
    return NextResponse.json({ error: "Sector not found" }, { status: 404 });
  }

  const [systems, vortexes, markers] = await Promise.all([
    getSystemsBySector(sector.id),
    getVortexesBySector(sector.id),
    getMarkersBySector(sector.id),
  ]);

  const endpoints: SearchableEndpoint[] = [
    ...systems.map((s) => ({ slug: s.slug, name: s.name, kind: "system" as const, id: s.id })),
    ...vortexes.map((v) => ({ slug: v.slug, name: v.name, kind: "vortex" as const, id: v.id })),
    ...markers.map((m) => ({ slug: m.slug, name: m.name, kind: "marker" as const, id: m.id })),
  ];

  return NextResponse.json({ endpoints });
}
