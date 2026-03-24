import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@libsql/client";

async function main() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
  try {
    const r = await db.execute("SELECT COUNT(*) as n FROM episode_ratings");
    console.log("✅ Connected — row count:", r.rows[0][0]);
    const sample = await db.execute("SELECT * FROM episode_ratings LIMIT 3");
    console.log("Sample rows:", sample.rows);
  } catch (err: any) {
    console.error("❌ Error:", err.message ?? err);
  }
}
main();
