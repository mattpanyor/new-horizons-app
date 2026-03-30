import type { KankaLocation, KankaPaginatedResponse } from "@/types/kanka";

const KANKA_BASE = "https://api.kanka.io/1.0";

let cachedMap: Map<string, string> | null = null;

/**
 * Fetch all Kanka location entities for the campaign and return a
 * lowercase-name → Kanka URL map.  Result is cached in-memory for the
 * lifetime of the server / build process.
 */
export async function getKankaLocationMap(): Promise<Map<string, string>> {
  if (cachedMap) return cachedMap;

  const token = process.env.KANKA_API;
  const campaignId = process.env.KANKA_CAMPAIGN_ID;

  if (!token || !campaignId) {
    cachedMap = new Map();
    return cachedMap;
  }

  const map = new Map<string, string>();
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const res = await fetch(
      `${KANKA_BASE}/campaigns/${campaignId}/locations?page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      console.warn(`[kanka] Failed to fetch locations page ${page}: ${res.status}`);
      break;
    }

    const json: KankaPaginatedResponse<KankaLocation> = await res.json();

    for (const loc of json.data) {
      map.set(
        loc.name.toLowerCase(),
        `https://app.kanka.io/w/${campaignId}/entities/${loc.entity_id}`,
      );
    }

    hasMore = json.links.next !== null;
    page++;
  }

  cachedMap = map;
  return cachedMap;
}
