import { cookies } from "next/headers";
import { getUserByUsername } from "@/lib/db/users";
import { upsertKankaEntity } from "@/lib/db/kankaEntities";

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

      const entityTypes = ["characters", "locations", "organisations"] as const;
      const typeLabels: Record<string, string> = {
        characters: "character",
        locations: "location",
        organisations: "organisation",
      };

      let totalSynced = 0;
      let totalErrors = 0;

      log("Starting Kanka sync...");
      log(`Campaign: ${KANKA_CAMPAIGN_ID}`);
      log("");

      for (const entityType of entityTypes) {
        log(`── Fetching ${entityType} ──`);
        let page = 1;
        let hasMore = true;
        let typeCount = 0;

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
              entity_id: number;
              name: string;
              type?: string | null;
              image_full?: string | null;
              image_thumb?: string | null;
              title?: string | null;
            }>;

            for (const e of entities) {
              try {
                await upsertKankaEntity({
                  entityId: e.entity_id,
                  name: e.name,
                  type: typeLabels[entityType],
                  imageUrl: e.image_full ?? e.image_thumb ?? null,
                  title: e.title ?? null,
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

        log(`  ${typeCount} ${entityType} synced`);
        log("");
      }

      log("────────────────────");
      log(`Sync complete: ${totalSynced} entities synced, ${totalErrors} errors`);

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
