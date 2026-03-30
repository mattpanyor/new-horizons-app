import type { KankaLocation, KankaMember, KankaPaginatedResponse } from "@/types/kanka";

const KANKA_BASE = "https://api.kanka.io/1.0";
const KANKA_TIMEOUT = 5000; // 5s timeout per request

let cachedMap: Map<string, string> | null = null;
let cachedMembers: Map<number, string> | null = null;

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

  try {
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
          signal: AbortSignal.timeout(KANKA_TIMEOUT),
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
  } catch (err) {
    console.warn(`[kanka] Location fetch failed:`, err);
  }

  cachedMap = map;
  return cachedMap;
}

/**
 * Fetch campaign members and return a id → display name map.
 * Cached in-memory for the server lifetime.
 */
export async function getKankaMemberMap(): Promise<Map<number, string>> {
  if (cachedMembers) return cachedMembers;

  const token = process.env.KANKA_API;
  const campaignId = process.env.KANKA_CAMPAIGN_ID;

  if (!token || !campaignId) {
    cachedMembers = new Map();
    return cachedMembers;
  }

  const map = new Map<number, string>();

  try {
    const res = await fetch(
      `${KANKA_BASE}/campaigns/${campaignId}/users`,
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
      console.warn(`[kanka] Failed to fetch campaign members: ${res.status}`);
    } else {
      const json: { data: KankaMember[] } = await res.json();
      for (const member of json.data) {
        map.set(member.id, member.name);
      }
    }
  } catch (err) {
    console.warn(`[kanka] Member fetch failed:`, err);
  }

  cachedMembers = map;
  return cachedMembers;
}
