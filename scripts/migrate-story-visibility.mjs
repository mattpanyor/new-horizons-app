// TEMPORARY one-off migration: story_entries.is_public (BOOLEAN) -> visibility (TEXT).
//
//   assigned — only players in assigned_usernames (was is_public = false)
//   players  — any logged-in player                (was is_public = true)
//   world    — anyone with the link, no login      (new level)
//
// Idempotent: safe to run more than once. Run with:
//   node scripts/migrate-story-visibility.mjs
// Delete this file once the migration has been applied to every environment.

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (checked .env.local). Aborting.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function main() {
  console.log("→ Adding visibility column (if missing)…");
  await sql.query(
    `ALTER TABLE story_entries
       ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'assigned'`
  );

  console.log("→ Backfilling from is_public and dropping it (if present)…");
  await sql.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'story_entries' AND column_name = 'is_public'
      ) THEN
        UPDATE story_entries SET visibility = 'players' WHERE is_public = TRUE;
        ALTER TABLE story_entries DROP COLUMN is_public;
      END IF;
    END $$;
  `);

  console.log("→ Ensuring visibility CHECK constraint…");
  await sql.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'story_entries_visibility_check'
      ) THEN
        ALTER TABLE story_entries
          ADD CONSTRAINT story_entries_visibility_check
          CHECK (visibility IN ('assigned', 'players', 'world'));
      END IF;
    END $$;
  `);

  const rows = await sql.query(
    `SELECT visibility, COUNT(*)::int AS n
       FROM story_entries GROUP BY visibility ORDER BY visibility`
  );
  console.log("✓ Migration complete. Entry counts by visibility:");
  if (rows.length === 0) {
    console.log("   (no story entries yet)");
  } else {
    for (const r of rows) console.log(`   ${r.visibility.padEnd(9)} ${r.n}`);
  }
}

main().catch((err) => {
  console.error("✗ Migration failed:", err);
  process.exit(1);
});
