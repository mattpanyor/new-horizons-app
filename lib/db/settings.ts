import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export interface AppSetting {
  key: string;
  value: string;
  updatedAt: string;
  updatedBy: string | null;
}

/** Writes the value and returns the stored row, so callers don't re-read it. */
export async function setSetting(
  key: string,
  value: string,
  updatedBy: string,
): Promise<AppSetting> {
  const rows = await sql`
    INSERT INTO app_settings (key, value, updated_by, updated_at)
    VALUES (${key}, ${value}, ${updatedBy}, NOW())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
    RETURNING key, value, updated_at, updated_by
  `;
  const row = rows[0];
  return {
    key: row.key as string,
    value: row.value as string,
    updatedAt: String(row.updated_at),
    updatedBy: (row.updated_by as string) ?? null,
  };
}

/**
 * The stored row, or null when the key is unset.
 *
 * Throws if the database is unreachable — deliberately. These settings decorate
 * pages that must still render when it is down, but the fallback belongs to the
 * caller: this result is cached, and a swallowed failure would be cached too,
 * pinning the wrong value until something invalidated it. See
 * lib/settings/service.ts, which catches around the cache rather than inside it.
 *
 * There is deliberately only one read. A `getSetting` that selected just the
 * value existed alongside this and issued different SQL for the same row, which
 * meant React's per-request cache could not dedupe the two — /admin/settings
 * fetched it twice.
 */
export async function getSettingRow(key: string): Promise<AppSetting | null> {
  const rows = await sql`
    SELECT key, value, updated_at, updated_by FROM app_settings WHERE key = ${key}
  `;
  if (!rows.length) return null;
  const row = rows[0];
  return {
    key: row.key as string,
    value: row.value as string,
    updatedAt: String(row.updated_at),
    updatedBy: (row.updated_by as string) ?? null,
  };
}
