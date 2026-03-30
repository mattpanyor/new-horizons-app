import type { KankaEntity, KankaPaginatedResponse } from "@/types/kanka";

const KANKA_BASE = "https://api.kanka.io/1.0";
const KANKA_TIMEOUT = 5000; // 5s timeout per request

export interface KankaEntityInfo {
  entityId: number;
  name: string;
  type: string; // 'character' | 'location' | 'organisation'
  image: string | null;
  title: string | null;
}

let cachedEntities: KankaEntityInfo[] | null = null;

/**
 * Fetch all characters, locations, and organisations from the campaign.
 * Returns a flat list with entity type, cached in-memory.
 */
export async function getKankaEntities(): Promise<KankaEntityInfo[]> {
  if (cachedEntities) return cachedEntities;

  const token = process.env.KANKA_API;
  const campaignId = process.env.KANKA_CAMPAIGN_ID;

  if (!token || !campaignId) {
    cachedEntities = [];
    return cachedEntities;
  }

  const entities: KankaEntityInfo[] = [];
  const types = ["characters", "locations", "organisations"] as const;
  const typeLabels: Record<string, string> = {
    characters: "character",
    locations: "location",
    organisations: "organisation",
  };

  for (const entityType of types) {
    try {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const res = await fetch(
          `${KANKA_BASE}/campaigns/${campaignId}/${entityType}?page=${page}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            cache: "no-store",
            signal: AbortSignal.timeout(KANKA_TIMEOUT),
          },
        );

        if (!res.ok) {
          console.warn(`[kanka] Failed to fetch ${entityType} page ${page}: ${res.status}`);
          break;
        }

        const json: KankaPaginatedResponse<KankaEntity> = await res.json();

        for (const e of json.data) {
          entities.push({
            entityId: e.entity_id,
            name: e.name,
            type: typeLabels[entityType],
            image: e.image_full ?? e.image_thumb ?? null,
            title: e.title ?? null,
          });
        }

        hasMore = json.links.next !== null;
        page++;
      }
    } catch (err) {
      console.warn(`[kanka] ${entityType} fetch failed:`, err);
    }
  }

  cachedEntities = entities;
  return cachedEntities;
}

/** Look up a single entity by entity_id from the cached list (used by admin) */
export async function getKankaEntityById(entityId: number): Promise<KankaEntityInfo | undefined> {
  // Check per-ID cache first
  const cached = entityByIdCache.get(entityId);
  if (cached) return cached;

  // Then check full entity cache if loaded
  if (cachedEntities) return cachedEntities.find((e) => e.entityId === entityId);

  // Otherwise fetch individually
  return fetchKankaEntityById(entityId);
}

const entityByIdCache = new Map<number, KankaEntityInfo>();

/** Fetch a single entity directly by entity_id from the Kanka API.
 *  Uses the entities endpoint for name/type, then follows the child URL for the image. */
export async function fetchKankaEntityById(entityId: number): Promise<KankaEntityInfo | undefined> {
  if (entityByIdCache.has(entityId)) return entityByIdCache.get(entityId);

  const token = process.env.KANKA_API;
  const campaignId = process.env.KANKA_CAMPAIGN_ID;
  if (!token || !campaignId) return undefined;

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  try {
    const res = await fetch(
      `${KANKA_BASE}/campaigns/${campaignId}/entities/${entityId}`,
      { headers, cache: "no-store", signal: AbortSignal.timeout(KANKA_TIMEOUT) },
    );

    if (!res.ok) return undefined;

    const json = await res.json();
    const e = json.data;

    // Fetch image from the child endpoint (entities endpoint doesn't include image URLs)
    let image: string | null = null;
    const childApiUrl = e.urls?.api as string | undefined;
    if (childApiUrl && e.image_uuid) {
      try {
        const childRes = await fetch(childApiUrl, {
          headers, cache: "no-store", signal: AbortSignal.timeout(KANKA_TIMEOUT),
        });
        if (childRes.ok) {
          const childJson = await childRes.json();
          image = childJson.data.image_full ?? childJson.data.image_thumb ?? null;
        }
      } catch { /* image unavailable, continue without it */ }
    }

    const info: KankaEntityInfo = {
      entityId: e.entity_id ?? entityId,
      name: e.name,
      type: e.type ?? "",
      image,
      title: e.title ?? null,
    };
    entityByIdCache.set(entityId, info);
    return info;
  } catch {
    return undefined;
  }
}
