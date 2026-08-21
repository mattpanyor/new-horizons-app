/**
 * TEMPORARY MIGRATION — delete this file once it has been run against every
 * environment that needs it.
 *
 * Adds clues.session_number: the game session a clue was discovered in.
 *
 * Nullable on purpose. Every clue written before this field existed has no
 * answer to "which session was this found in", and inventing one would be
 * worse than leaving it blank — the web UI treats null as "not recorded" and
 * simply omits the line from the tile.
 *
 * Safe to run more than once (IF NOT EXISTS), and safe to run while the old
 * code is still deployed: adding a nullable column with no default does not
 * rewrite the table, and no existing query names the new column.
 *
 * Run:  node scripts/add-clue-session-number.mjs
 * Undo: ALTER TABLE clues DROP COLUMN session_number;
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Same layering Next.js uses: .env holds DATABASE_URL, .env.local overrides it.
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (looked in .env.local and .env)");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function columnExists() {
  const rows = await sql`
    SELECT data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'clues' AND column_name = 'session_number'
  `;
  return rows[0] ?? null;
}

async function main() {
  const before = await columnExists();
  if (before) {
    console.log(
      `clues.session_number already exists (${before.data_type}, nullable=${before.is_nullable}) — nothing to do.`
    );
  } else {
    await sql`ALTER TABLE clues ADD COLUMN IF NOT EXISTS session_number INTEGER`;
    const after = await columnExists();
    if (!after) {
      console.error("ALTER ran but the column is still missing — check permissions.");
      process.exit(1);
    }
    console.log(`Added clues.session_number (${after.data_type}, nullable=${after.is_nullable}).`);
  }

  const [{ total, with_session }] = await sql`
    SELECT COUNT(*)::int AS total,
           COUNT(session_number)::int AS with_session
    FROM clues
  `;
  console.log(
    `${total} clue(s) total — ${with_session} with a session number, ${total - with_session} without.`
  );
  console.log("Existing clues are left blank deliberately; set them from the admin panel as needed.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
