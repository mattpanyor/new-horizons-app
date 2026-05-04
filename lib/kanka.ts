// Single source of truth for the Kanka campaign URL.
//
// Kept free of DB / server-only imports so it can be used from client
// components (e.g. clue mention rendering) without dragging the Postgres
// driver into the client bundle.

export const KANKA_CAMPAIGN_ID = "96303";

export function kankaEntityUrl(entityId: number | string): string {
  return `https://app.kanka.io/w/${KANKA_CAMPAIGN_ID}/entities/${entityId}`;
}
