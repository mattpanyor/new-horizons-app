import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export interface ShipItemRow {
  id: number;
  category: "cargo" | "isolation";
  name: string;
  quantity: number;
  imageUrl: string | null;
  description: string | null;
  createdAt: string;
}

function rowToShipItem(row: Record<string, unknown>): ShipItemRow {
  return {
    id: row.id as number,
    category: row.category as "cargo" | "isolation",
    name: row.name as string,
    quantity: row.quantity as number,
    imageUrl: (row.image_url as string) ?? null,
    description: (row.description as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function getShipItemsByCategory(
  category: "cargo" | "isolation"
): Promise<ShipItemRow[]> {
  const rows = await sql`
    SELECT * FROM ship_items WHERE category = ${category} ORDER BY created_at ASC
  `;
  return rows.map(rowToShipItem);
}

export async function createShipItem(fields: {
  category: "cargo" | "isolation";
  name: string;
  quantity?: number;
  imageUrl?: string;
  description?: string;
}): Promise<ShipItemRow> {
  const rows = await sql`
    INSERT INTO ship_items (category, name, quantity, image_url, description)
    VALUES (${fields.category}, ${fields.name}, ${fields.quantity ?? 1}, ${fields.imageUrl ?? null}, ${fields.description ?? null})
    RETURNING *
  `;
  return rowToShipItem(rows[0]);
}

export async function updateShipItem(
  id: number,
  fields: {
    name: string;
    quantity: number;
    imageUrl: string | null;
    description: string | null;
  }
): Promise<ShipItemRow | null> {
  const rows = await sql`
    UPDATE ship_items SET
      name        = ${fields.name},
      quantity    = ${fields.quantity},
      image_url   = ${fields.imageUrl},
      description = ${fields.description}
    WHERE id = ${id}
    RETURNING *
  `;
  return rows.length > 0 ? rowToShipItem(rows[0]) : null;
}

export async function deleteShipItem(id: number): Promise<boolean> {
  const rows = await sql`
    DELETE FROM ship_items WHERE id = ${id} RETURNING id
  `;
  return rows.length > 0;
}
