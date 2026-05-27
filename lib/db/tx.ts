// Transaction helper for the map-editor save endpoints.
//
// The @neondatabase/serverless package exposes two query interfaces:
//   - neon(url): HTTP-based tagged-template — one round-trip per call,
//     CANNOT do interactive transactions (each call is independent).
//   - Pool/Client: WebSocket-based, pg-compatible — supports BEGIN/COMMIT/
//     ROLLBACK over a persistent connection.
//
// We use Pool only for the save endpoints (where atomicity matters).
// Read paths and single-statement writes continue to use the HTTP `neon()`
// driver from each lib/db/* module — that path is faster and stateless.
//
// Pattern:
//   await withTransaction(async (tx) => {
//     await deleteSystem(id, tx);
//     await insertSystem({...}, tx);
//     // throw to roll back
//   });
//
// Each lib/db/* helper accepts an optional `tx?: Tx` parameter. When
// provided, the helper routes queries through the transaction client
// (atomic with the rest of the block). When omitted, it falls back to the
// module-scoped HTTP `neon` driver (single-shot). The two paths share the
// same parameterized SQL string via execQuery().

import { Pool, neonConfig, neon, type PoolClient } from "@neondatabase/serverless";

// Node 22+ has native WebSocket; older runtimes need a constructor. Detect
// at module load. If neither is present the Pool will throw on .connect()
// with a clear error, which is the right behavior — better than silent
// fallback to non-transactional execution.
if (typeof WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = WebSocket;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sqlHttp = neon(process.env.DATABASE_URL!);

export type Tx = PoolClient;

/**
 * Run a parameterized query against either a transaction client or the
 * stateless HTTP driver. Always returns row objects (snake_case columns).
 *
 * Why a single helper: every lib/db/* function can now use ONE SQL string
 * and route it correctly based on whether the caller is inside a
 * transaction. No duplicate SQL bodies.
 */
export async function execQuery<T = Record<string, unknown>>(
  tx: Tx | undefined,
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  if (tx) {
    const result = await tx.query(text, params);
    return result.rows as T[];
  }
  // The neon HTTP driver's .query() form accepts (text, params) — same
  // parameterized shape as pg, so we can share the SQL string between
  // tx and non-tx callers.
  const rows = (await sqlHttp.query(text, params)) as unknown as T[];
  return rows;
}

/**
 * Open a transaction, run the callback, COMMIT on success or ROLLBACK on
 * throw. The PoolClient is released back to the pool either way.
 *
 * The callback receives a `Tx` (PoolClient). Pass it to every lib/db/*
 * helper called inside the block — including helpers that call OTHER
 * helpers (e.g. updateSystem → cascadeSlugRename), or those nested calls
 * will run on a separate connection, outside the transaction, defeating
 * the point.
 */
export async function withTransaction<T>(
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback failure — original error is more useful
    }
    throw e;
  } finally {
    client.release();
  }
}
