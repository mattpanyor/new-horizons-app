import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(__dirname, "../../.env.local") });

const sql = neon(process.env.DATABASE_URL!);

const users = [
  { username: "gm", password: "gm", group: "GM", role: "Gamemaster", accessLevel: 127 },
  { username: "geri", password: "AD", group: "Applied Discorvery", role: "Sentinel", character: "Vaelin Thryndal" },
  { username: "gary", password: "CSI", group: "Cathedral of Solis Invictus", role: "Justicar", character: "Malrik Thane" },
  { username: "tundi", password: "LIIX", group: "Lenard Institute of Interspecies and Xenosciences", role: "Chancelor", character: "Baronet Danarill Lenard" },
  { username: "alex", password: "SA", group: "Sanctum Arcanum", role: "Senior Artificer", character: "Arion Fabrius" },
];

async function seed() {
  // Create table
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      username   VARCHAR(50)  UNIQUE NOT NULL,
      password   VARCHAR(255) NOT NULL,
      "group"    VARCHAR(100) NOT NULL,
      role       VARCHAR(100),
      character  VARCHAR(100),
      access_level INTEGER NOT NULL DEFAULT 0
    )
  `;

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    await sql`
      INSERT INTO users (username, password, "group", role, character, access_level)
      VALUES (${u.username}, ${hash}, ${u.group}, ${u.role ?? null}, ${u.character ?? null}, ${"accessLevel" in u ? (u as { accessLevel: number }).accessLevel : 0})
      ON CONFLICT (username) DO UPDATE SET
        password     = EXCLUDED.password,
        "group"      = EXCLUDED."group",
        role         = EXCLUDED.role,
        character    = EXCLUDED.character,
        access_level = EXCLUDED.access_level
    `;
    console.log(`Seeded user: ${u.username}`);
  }

  console.log("Done.");
}

seed().catch(console.error);
