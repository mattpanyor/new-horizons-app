import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export interface AppSetting {
  key: string;
  value: string;
  updatedAt: string;
  updatedBy: string | null;
}

/**
 * Raw read. Returns null when unset — callers decide the default.
 *
 * A failed read also returns null rather than throwing: these settings decorate
 * pages that must still render if the database is unreachable, so a background
 * lookup is never allowed to take a page down with it.
 */
export async function getSetting(key: string): Promise<string | null> {
  try {
    const rows = await sql`SELECT value FROM app_settings WHERE key = ${key}`;
    return rows.length ? (rows[0].value as string) : null;
  } catch (err) {
    console.error(`getSetting(${key}) failed:`, err);
    return null;
  }
}

export async function setSetting(key: string, value: string, updatedBy: string) {
  await sql`
    INSERT INTO app_settings (key, value, updated_by, updated_at)
    VALUES (${key}, ${value}, ${updatedBy}, NOW())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
  `;
}

export async function getSettingRow(key: string): Promise<AppSetting | null> {
  try {
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
  } catch (err) {
    console.error(`getSettingRow(${key}) failed:`, err);
    return null;
  }
}
