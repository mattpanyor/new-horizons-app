import { neon } from "@neondatabase/serverless";
import type { StarRole } from "@/lib/mapEnums";

const sql = neon(process.env.DATABASE_URL!);

export interface StarRow {
  id: number;
  systemId: number;
  role: StarRole;
  name: string;
  fantasyLabel: string | null;
  color: string;
  secondaryColor: string | null;
  externalUrl: string | null;
}

function rowToStar(row: Record<string, unknown>): StarRow {
  return {
    id: row.id as number,
    systemId: row.system_id as number,
    role: row.role as StarRole,
    name: row.name as string,
    fantasyLabel: (row.fantasy_label as string) ?? null,
    color: row.color as string,
    secondaryColor: (row.secondary_color as string) ?? null,
    externalUrl: (row.external_url as string) ?? null,
  };
}

export async function getStarsBySystem(systemId: number): Promise<StarRow[]> {
  const rows = await sql`
    SELECT id, system_id, role, name, fantasy_label, color, secondary_color, external_url
    FROM stars WHERE system_id = ${systemId} ORDER BY role
  `;
  return rows.map(rowToStar);
}

export async function insertStar(s: {
  systemId: number;
  role: StarRole;
  name: string;
  fantasyLabel?: string | null;
  color: string;
  secondaryColor?: string | null;
  externalUrl?: string | null;
}): Promise<StarRow> {
  const rows = await sql`
    INSERT INTO stars (system_id, role, name, fantasy_label, color, secondary_color, external_url)
    VALUES (${s.systemId}, ${s.role}, ${s.name}, ${s.fantasyLabel ?? null},
            ${s.color}, ${s.secondaryColor ?? null}, ${s.externalUrl ?? null})
    RETURNING id, system_id, role, name, fantasy_label, color, secondary_color, external_url
  `;
  return rowToStar(rows[0]);
}

// Upsert by (system_id, role) — used by the system save endpoint to avoid
// branching on "does the row already exist?" when toggling between center kinds.
export async function upsertStar(s: {
  systemId: number;
  role: StarRole;
  name: string;
  fantasyLabel?: string | null;
  color: string;
  secondaryColor?: string | null;
  externalUrl?: string | null;
}): Promise<void> {
  await sql`
    INSERT INTO stars (system_id, role, name, fantasy_label, color, secondary_color, external_url)
    VALUES (${s.systemId}, ${s.role}, ${s.name}, ${s.fantasyLabel ?? null},
            ${s.color}, ${s.secondaryColor ?? null}, ${s.externalUrl ?? null})
    ON CONFLICT (system_id, role) DO UPDATE SET
      name = EXCLUDED.name,
      fantasy_label = EXCLUDED.fantasy_label,
      color = EXCLUDED.color,
      secondary_color = EXCLUDED.secondary_color,
      external_url = EXCLUDED.external_url
  `;
}

export async function deleteStarByRole(systemId: number, role: StarRole): Promise<void> {
  await sql`DELETE FROM stars WHERE system_id = ${systemId} AND role = ${role}`;
}
