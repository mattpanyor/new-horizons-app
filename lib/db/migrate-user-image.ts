import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function migrate() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log("Adding image_url column to users...");
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS image_url TEXT`;

  console.log("Setting random CDN images for existing users...");
  const images = [
    "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/ashford_logo.png",
    "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/fairfield_logo.png",
    "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/feyrose_logo.png",
    "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/lenard_logo.png",
    "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/exploratorium_logo.png",
    "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/inquisitorium_logo.png",
  ];

  const users = await sql`SELECT id FROM users ORDER BY id`;
  for (let i = 0; i < users.length; i++) {
    const img = images[i % images.length];
    await sql`UPDATE users SET image_url = ${img} WHERE id = ${users[i].id}`;
    console.log(`  User #${users[i].id} → ${img.split("/").pop()}`);
  }

  console.log("Done.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
