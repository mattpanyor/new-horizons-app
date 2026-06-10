import type { StarRole } from "@/lib/mapEnums";
import { execQuery, type Tx } from "@/lib/db/tx";

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

export async function getStarsBySystem(systemId: number, tx?: Tx): Promise<StarRow[]> {
  const rows = await execQuery(tx,
    `SELECT id, system_id, role, name, fantasy_label, color, secondary_color, external_url
     FROM stars WHERE system_id = $1 ORDER BY role`,
    [systemId]
  );
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
}, tx?: Tx): Promise<StarRow> {
  const rows = await execQuery(tx,
    `INSERT INTO stars (system_id, role, name, fantasy_label, color, secondary_color, external_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, system_id, role, name, fantasy_label, color, secondary_color, external_url`,
    [s.systemId, s.role, s.name, s.fantasyLabel ?? null, s.color, s.secondaryColor ?? null, s.externalUrl ?? null]
  );
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
}, tx?: Tx): Promise<void> {
  await execQuery(tx,
    `INSERT INTO stars (system_id, role, name, fantasy_label, color, secondary_color, external_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (system_id, role) DO UPDATE SET
       name = EXCLUDED.name,
       fantasy_label = EXCLUDED.fantasy_label,
       color = EXCLUDED.color,
       secondary_color = EXCLUDED.secondary_color,
       external_url = EXCLUDED.external_url`,
    [s.systemId, s.role, s.name, s.fantasyLabel ?? null, s.color, s.secondaryColor ?? null, s.externalUrl ?? null]
  );
}

export async function deleteStarByRole(systemId: number, role: StarRole, tx?: Tx): Promise<void> {
  await execQuery(tx, `DELETE FROM stars WHERE system_id = $1 AND role = $2`, [systemId, role]);
}
