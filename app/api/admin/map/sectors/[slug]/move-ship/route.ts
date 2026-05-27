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
//
// All writes (and the cross-table reads they depend on) run inside a single
// BEGIN/COMMIT transaction so a partial body→marker translation (delete
// succeeded, insert failed, or vice versa) rolls back cleanly.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getUserByUsername } from "@/lib/db/users";
import { getSectorRowBySlug } from "@/lib/db/sectors";
import { withTransaction } from "@/lib/db/tx";

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

// Custom error class so we can surface 404s / 409s from inside the
// transaction without leaking pg error shapes.
class MoveError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
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

  try {
    await withTransaction(async (tx) => {
      // ── BRANCH ON SOURCE/DESTINATION ──

      if (srcBody !== undefined) {
        // Source is a celestial_bodies row. Confirm it exists, belongs to
        // this sector via its system, and is a ship/fleet.
        const bodyRes = await tx.query(
          `SELECT b.*, s.sector_id, s.slug AS system_slug
           FROM celestial_bodies b
           JOIN systems s ON s.id = b.system_id
           WHERE b.id = $1`,
          [srcBody]
        );
        const body = bodyRes.rows[0];
        if (!body) throw new MoveError("Source body not found", 404);
        if (body.sector_id !== sector.id) throw new MoveError("Source body is in a different sector", 400);
        if (body.type !== "ship" && body.type !== "fleet") throw new MoveError("Source body is not a ship or fleet", 400);

        if (dstSystem !== undefined) {
          // body → body (different system). Update system_id, reset orbit
          // to sensible defaults so the body doesn't land at a weird
          // position.
          const targetRes = await tx.query(
            `SELECT id FROM systems WHERE id = $1 AND sector_id = $2`,
            [dstSystem, sector.id]
          );
          const target = targetRes.rows[0];
          if (!target) throw new MoveError("Target system not in this sector", 404);
          if (target.id === body.system_id) throw new MoveError("Source and destination system are the same", 400);
          await tx.query(
            `UPDATE celestial_bodies
             SET system_id = $1, orbit_position = 0, orbit_distance = 0.5
             WHERE id = $2`,
            [dstSystem, srcBody]
          );
        } else {
          // body → marker on connection. Delete body, insert marker.
          const targetRes = await tx.query(
            `SELECT id FROM connections WHERE id = $1 AND sector_id = $2`,
            [dstConn, sector.id]
          );
          const target = targetRes.rows[0];
          if (!target) throw new MoveError("Target connection not in this sector", 404);
          // Prefer the source body_id as the marker slug — avoids the
          // accumulating -<date-suffix>-<date-suffix> growth on round-trip
          // moves. Only append a disambiguation suffix if the slug is
          // already taken in this sector's markers table.
          const baseSlug = (body.body_id ?? `ship-${srcBody}`).toString();
          let markerSlug = baseSlug;
          const collisionRes = await tx.query(
            `SELECT 1 FROM markers WHERE sector_id = $1 AND slug = $2 LIMIT 1`,
            [sector.id, markerSlug]
          );
          if (collisionRes.rows.length > 0) {
            markerSlug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;
          }
          // Carry every field that has a sensible analogue on a marker.
          // Biome, lore, label_position, special_attribute don't apply to
          // a moving ship, so they're dropped here (and a body→marker→body
          // round-trip is a documented one-way trim — see map-migration.md
          // if/when re-exported).
          await tx.query(
            `INSERT INTO markers (
               sector_id, slug, name, type, allegiance_slug, external_url,
               connection_id, position
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              sector.id, markerSlug, body.name, body.type,
              body.allegiance_slug, body.external_url,
              dstConn, 0.5,
            ]
          );
          await tx.query(`DELETE FROM celestial_bodies WHERE id = $1`, [srcBody]);
        }
      } else {
        // Source is a markers row.
        const markerRes = await tx.query(
          `SELECT * FROM markers WHERE id = $1 AND sector_id = $2`,
          [srcMarker, sector.id]
        );
        const marker = markerRes.rows[0];
        if (!marker) throw new MoveError("Source marker not found", 404);
        if (marker.type !== "ship" && marker.type !== "fleet") throw new MoveError("Source marker is not a ship or fleet", 400);

        if (dstSystem !== undefined) {
          // marker → body in target system. Delete marker, insert body.
          const targetRes = await tx.query(
            `SELECT id, slug FROM systems WHERE id = $1 AND sector_id = $2`,
            [dstSystem, sector.id]
          );
          const target = targetRes.rows[0];
          if (!target) throw new MoveError("Target system not in this sector", 404);
          // Use the marker slug as-is when possible; fall back to
          // slugified name for legacy markers without a slug. If the
          // (system_id, body_id) pair collides we'd hit a UNIQUE
          // violation — pre-check and either dedupe with a suffix or 409.
          const baseSlug = (marker.slug ?? marker.name).toString().toLowerCase().replace(/[^a-z0-9]+/g, "-");
          let bodyId = baseSlug;
          const collisionRes = await tx.query(
            `SELECT 1 FROM celestial_bodies
             WHERE system_id = $1 AND body_id = $2
             LIMIT 1`,
            [dstSystem, bodyId]
          );
          if (collisionRes.rows.length > 0) {
            bodyId = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;
            const stillCollidingRes = await tx.query(
              `SELECT 1 FROM celestial_bodies
               WHERE system_id = $1 AND body_id = $2
               LIMIT 1`,
              [dstSystem, bodyId]
            );
            if (stillCollidingRes.rows.length > 0) {
              throw new MoveError(`Target system already has a body with id '${baseSlug}'`, 409);
            }
          }
          await tx.query(
            `INSERT INTO celestial_bodies (
               system_id, body_id, name, type, allegiance_slug, external_url,
               orbit_position, orbit_distance, label_position
             ) VALUES ($1, $2, $3, $4, $5, $6, 0, 0.5, 'bottom')`,
            [
              dstSystem, bodyId, marker.name, marker.type,
              marker.allegiance_slug, marker.external_url,
            ]
          );
          await tx.query(`DELETE FROM markers WHERE id = $1`, [srcMarker]);
        } else {
          // marker → different connection. Atomic positional update.
          const targetRes = await tx.query(
            `SELECT id FROM connections WHERE id = $1 AND sector_id = $2`,
            [dstConn, sector.id]
          );
          const target = targetRes.rows[0];
          if (!target) throw new MoveError("Target connection not in this sector", 404);
          if (target.id === marker.connection_id) throw new MoveError("Marker is already on this connection", 400);
          await tx.query(
            `UPDATE markers
             SET connection_id = $1, position = 0.5,
                 x = NULL, y = NULL, angle = NULL
             WHERE id = $2`,
            [dstConn, srcMarker]
          );
        }
      }
    });
  } catch (e) {
    if (e instanceof MoveError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Move failed: ${msg}` }, { status: 500 });
  }

  revalidatePath("/sectors");
  revalidatePath(`/sectors/${slug}`);
  return NextResponse.json({ ok: true });
}
