// Ship/fleet move endpoint. Translates a ship between the two
// representations the user actually models: a celestial_bodies row (ship
// inside a system) and a markers row (ship attached to a connection).
//
// Source is either { bodyId } or { markerId }. Destination is either
// { systemId } or { connectionId }. The four combinations:
//
//   body → system     : UPDATE celestial_bodies SET system_id, reset orbit
//   body → connection : DELETE body, INSERT marker on the connection
//   marker → system   : DELETE marker, INSERT body in the system
//   marker → conn     : UPDATE markers (atomic positional swap)
//
// Auth: superadmin only. Sector-scoped — source and destination must belong
// to the same sector as the URL param.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { neon } from "@neondatabase/serverless";
import { getUserByUsername } from "@/lib/db/users";
import { getSectorRowBySlug } from "@/lib/db/sectors";

const sql = neon(process.env.DATABASE_URL!);

async function requireSuperAdmin() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) return null;
  const user = await getUserByUsername(username);
  if (!user || user.accessLevel < 127) return null;
  return user;
}

const bad = (msg: string, code = 400) => NextResponse.json({ error: msg }, { status: code });

interface Payload {
  source?: { bodyId?: number; markerId?: number };
  destination?: { systemId?: number; connectionId?: number };
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const admin = await requireSuperAdmin();
  if (!admin) return bad("Forbidden", 403);

  const { slug } = await params;
  if (slug === "imperial-core" || slug === "atlas-sector-legacy") {
    return bad(`Sector '${slug}' is not editable through this endpoint.`);
  }

  const sector = await getSectorRowBySlug(slug);
  if (!sector) return bad("Sector not found", 404);

  let payload: Payload;
  try { payload = await req.json() as Payload; } catch { return bad("Invalid JSON"); }

  const srcBody = payload.source?.bodyId;
  const srcMarker = payload.source?.markerId;
  const dstSystem = payload.destination?.systemId;
  const dstConn = payload.destination?.connectionId;

  if ((srcBody === undefined) === (srcMarker === undefined)) {
    return bad("Specify exactly one source: bodyId or markerId");
  }
  if ((dstSystem === undefined) === (dstConn === undefined)) {
    return bad("Specify exactly one destination: systemId or connectionId");
  }

  // ── BRANCH ON SOURCE/DESTINATION ──

  if (srcBody !== undefined) {
    // Source is a celestial_bodies row. Confirm it exists, belongs to this
    // sector via its system, and is a ship/fleet.
    const [body] = await sql`
      SELECT b.*, s.sector_id, s.slug AS system_slug
      FROM celestial_bodies b
      JOIN systems s ON s.id = b.system_id
      WHERE b.id = ${srcBody}
    `;
    if (!body) return bad("Source body not found", 404);
    if (body.sector_id !== sector.id) return bad("Source body is in a different sector");
    if (body.type !== "ship" && body.type !== "fleet") return bad("Source body is not a ship or fleet");

    if (dstSystem !== undefined) {
      // body → body (different system). Update system_id, reset orbit to
      // sensible defaults so the body doesn't land at a weird position.
      const [target] = await sql`
        SELECT id FROM systems WHERE id = ${dstSystem} AND sector_id = ${sector.id}
      `;
      if (!target) return bad("Target system not in this sector");
      if (target.id === body.system_id) return bad("Source and destination system are the same");
      await sql`
        UPDATE celestial_bodies
        SET system_id = ${dstSystem}, orbit_position = 0, orbit_distance = 0.5
        WHERE id = ${srcBody}
      `;
    } else {
      // body → marker on connection. Delete body, insert marker.
      const [target] = await sql`
        SELECT id FROM connections WHERE id = ${dstConn} AND sector_id = ${sector.id}
      `;
      if (!target) return bad("Target connection not in this sector");
      const markerSlug = `${body.body_id ?? `ship-${srcBody}`}-${Date.now().toString(36)}`;
      // Position 0.5 = midpoint, GM can tweak after.
      await sql`
        INSERT INTO markers (
          sector_id, slug, name, type, allegiance_slug, external_url,
          connection_id, position
        ) VALUES (
          ${sector.id}, ${markerSlug}, ${body.name}, ${body.type},
          ${body.allegiance_slug}, ${body.external_url},
          ${dstConn}, 0.5
        )
      `;
      await sql`DELETE FROM celestial_bodies WHERE id = ${srcBody}`;
    }
  } else {
    // Source is a markers row.
    const [marker] = await sql`
      SELECT * FROM markers WHERE id = ${srcMarker} AND sector_id = ${sector.id}
    `;
    if (!marker) return bad("Source marker not found", 404);
    if (marker.type !== "ship" && marker.type !== "fleet") return bad("Source marker is not a ship or fleet");

    if (dstSystem !== undefined) {
      // marker → body in target system. Delete marker, insert body.
      const [target] = await sql`
        SELECT id, slug FROM systems WHERE id = ${dstSystem} AND sector_id = ${sector.id}
      `;
      if (!target) return bad("Target system not in this sector");
      const bodyId = (marker.slug ?? marker.name).toString().toLowerCase().replace(/[^a-z0-9]+/g, "-");
      await sql`
        INSERT INTO celestial_bodies (
          system_id, body_id, name, type, allegiance_slug, external_url,
          orbit_position, orbit_distance, label_position
        ) VALUES (
          ${dstSystem}, ${bodyId}, ${marker.name}, ${marker.type},
          ${marker.allegiance_slug}, ${marker.external_url},
          0, 0.5, 'bottom'
        )
      `;
      await sql`DELETE FROM markers WHERE id = ${srcMarker}`;
    } else {
      // marker → different connection. Atomic positional update (XOR check).
      const [target] = await sql`
        SELECT id FROM connections WHERE id = ${dstConn} AND sector_id = ${sector.id}
      `;
      if (!target) return bad("Target connection not in this sector");
      if (target.id === marker.connection_id) return bad("Marker is already on this connection");
      await sql`
        UPDATE markers
        SET connection_id = ${dstConn}, position = 0.5,
            x = NULL, y = NULL, angle = NULL
        WHERE id = ${srcMarker}
      `;
    }
  }

  revalidatePath("/sectors");
  revalidatePath(`/sectors/${slug}`);
  return NextResponse.json({ ok: true });
}
