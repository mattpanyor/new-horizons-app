import { cookies } from "next/headers";
import { getUserByUsername } from "@/lib/db/users";
import { upsertKankaEntity, type KankaMember } from "@/lib/db/kankaEntities";

const KANKA_BASE = "https://api.kanka.io/1.0";
const KANKA_CAMPAIGN_ID = "96303";
const KANKA_TIMEOUT = 10000;

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return new Response(JSON.stringify({ error: "Sync is only available in development" }), { status: 403 });
  }

  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const user = await getUserByUsername(username);
  if (!user || user.accessLevel < 66) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  const token = process.env.KANKA_API;

  if (!token) {
    return new Response(JSON.stringify({ error: "KANKA_API environment variable not configured" }), { status: 500 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function log(msg: string) {
        controller.enqueue(encoder.encode(msg + "\n"));
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      // ORDER MATTERS. Each type is resolved against the local-id maps built by
      // the types before it: characters reference locations, organisations and
      // families reference characters. Reordering silently drops references —
      // the map lookup just misses and the reference is counted as dropped.
      const entityTypes = ["locations", "characters", "organisations", "families"] as const;
      const typeLabels: Record<string, string> = {
        locations: "location",
        characters: "character",
        organisations: "organisation",
        families: "family",
      };

      // Kanka's relation payloads reference TYPE-LOCAL ids, not entity_ids — a
      // character is character 1043764 and entity 4006898, and an organisation's
      // member list names the former. Everything this app stores keys on
      // entity_id, so the local id is resolved here and never persisted.
      //
      // The maps are filled as each type streams past; see the note on
      // entityTypes for why the fetch order is load-bearing.
      const characterEntityId = new Map<number, number>();
      const locationEntityId = new Map<number, number>();

      // A character's immediate location. Kanka types this as an array and we
      // keep it as one, though no character in this campaign has more than a
      // single entry. Ancestry is deliberately not followed: the full path
      // needs a related=1 request per location, and the immediate seat is
      // what the app actually shows.
      function buildLocations(
        kind: (typeof entityTypes)[number],
        raw: unknown,
      ): number[] | null {
        if (kind !== "characters") return null;
        const out: number[] = [];
        for (const localId of (raw ?? []) as number[]) {
          const entityId = locationEntityId.get(localId);
          if (entityId === undefined) {
            totalDropped++;
            continue;
          }
          out.push(entityId);
        }
        return out;
      }

      function buildMembers(
        kind: (typeof entityTypes)[number],
        raw: unknown,
      ): KankaMember[] | null {
        // Organisations carry full join records with a free-text role; families
        // carry a bare array of character ids and no role at all. Null (rather
        // than an empty array) marks a kind that cannot have members, so an
        // organisation with nobody in it stays distinguishable from a location.
        if (kind === "organisations") {
          const out: KankaMember[] = [];
          for (const m of (raw ?? []) as Array<{ character_id: number; role?: string | null }>) {
            const entityId = characterEntityId.get(m.character_id);
            if (entityId === undefined) {
              totalDropped++;
              continue;
            }
            out.push(m.role ? { entityId, role: m.role } : { entityId });
          }
          return out;
        }
        if (kind === "families") {
          const out: KankaMember[] = [];
          for (const localId of (raw ?? []) as number[]) {
            const entityId = characterEntityId.get(localId);
            if (entityId === undefined) {
              totalDropped++;
              continue;
            }
            out.push({ entityId });
          }
          return out;
        }
        return null;
      }

      let totalSynced = 0;
      let totalSkipped = 0;
      // References naming an entity we did not store — private, or absent from a
      // failed page. Counted rather than silently swallowed: a sudden jump means
      // an earlier fetch is broken, not that the GM emptied an organisation.
      let totalDropped = 0;
      let totalErrors = 0;

      log("Starting Kanka sync...");
      log(`Campaign: ${KANKA_CAMPAIGN_ID}`);
      log("");

      for (const entityType of entityTypes) {
        log(`── Fetching ${entityType} ──`);
        let page = 1;
        let hasMore = true;
        let typeCount = 0;
        let typeSkipped = 0;

        while (hasMore) {
          try {
            const res = await fetch(
              `${KANKA_BASE}/campaigns/${KANKA_CAMPAIGN_ID}/${entityType}?page=${page}`,
              {
                headers,
                cache: "no-store",
                signal: AbortSignal.timeout(KANKA_TIMEOUT),
              },
            );

            if (!res.ok) {
              log(`  ERROR: Page ${page} returned ${res.status}`);
              totalErrors++;
              break;
            }

            const json = await res.json();
            const entities = json.data as Array<{
              id: number;
              entity_id: number;
              name: string;
              type?: string | null;
              image_full?: string | null;
              image_thumb?: string | null;
              title?: string | null;
              entry?: string | null;
              is_private?: boolean;
              members?: unknown;
              locations?: unknown;
            }>;

            for (const e of entities) {
              // Private in Kanka means GM-only. The app has no equivalent gate on
              // the read paths — the mention picker and investigation_search_entities
              // serve every synced row to any logged-in player — so a private entity
              // is never stored in the first place.
              if (e.is_private) {
                log(`  · ${e.name} (private, skipped)`);
                typeSkipped++;
                totalSkipped++;
                continue;
              }

              if (entityType === "characters") characterEntityId.set(e.id, e.entity_id);
              if (entityType === "locations") locationEntityId.set(e.id, e.entity_id);

              try {
                await upsertKankaEntity({
                  entityId: e.entity_id,
                  name: e.name,
                  type: typeLabels[entityType],
                  imageUrl: e.image_full ?? e.image_thumb ?? null,
                  title: e.title ?? null,
                  entry: e.entry ?? null,
                  members: buildMembers(entityType, e.members),
                  locations: buildLocations(entityType, e.locations),
                });
                log(`  ✓ ${e.name}`);
                typeCount++;
                totalSynced++;
              } catch (err) {
                log(`  ✗ ${e.name}: ${String(err)}`);
                totalErrors++;
              }
            }

            hasMore = json.links?.next !== null;
            page++;
          } catch (err) {
            log(`  ERROR: ${String(err)}`);
            totalErrors++;
            break;
          }
        }

        log(`  ${typeCount} ${entityType} synced${typeSkipped > 0 ? `, ${typeSkipped} private skipped` : ""}`);
        log("");
      }

      log("────────────────────");
      log(
        `Sync complete: ${totalSynced} entities synced, ` +
          `${totalSkipped} private skipped, ${totalDropped} refs dropped, ` +
          `${totalErrors} errors`,
      );

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}
