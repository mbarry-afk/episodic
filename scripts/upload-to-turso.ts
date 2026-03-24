/**
 * One-shot script: reads the existing local imdb.db and pushes all rows to Turso.
 * Run with: npx tsx scripts/upload-to-turso.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "imdb.db");

const tursoUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN ?? "";

if (!tursoUrl) {
  console.error("TURSO_DATABASE_URL not set in .env.local");
  process.exit(1);
}

const apiBase = tursoUrl.replace(/^libsql:\/\//, "https://");

async function tursoExec(sql: string, args: (string | number)[] = [], retries = 5) {
  const body = JSON.stringify({
    requests: [
      {
        type: "execute",
        stmt: {
          sql,
          args: args.map((v) =>
            typeof v === "number"
              ? { type: "float", value: v }
              : { type: "text", value: v }
          ),
        },
      },
      { type: "close" },
    ],
  });
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${apiBase}/v2/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body,
      });
      if (!res.ok) throw new Error(`Turso HTTP ${res.status}: ${await res.text()}`);
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      const wait = attempt * 2000;
      process.stdout.write(`\n  [retry ${attempt}/${retries - 1} in ${wait / 1000}s] ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

async function main() {
  const db = new Database(DB_PATH, { readonly: true });

  const { n } = db
    .prepare("SELECT COUNT(*) AS n FROM episode_ratings")
    .get() as { n: number };
  console.log(`Local DB has ${n.toLocaleString()} rows`);

  console.log("Creating table in Turso (if not exists) and clearing old data…");
  await tursoExec(
    `CREATE TABLE IF NOT EXISTS episode_ratings (tconst TEXT PRIMARY KEY, rating REAL NOT NULL, votes INTEGER NOT NULL)`
  );
  await tursoExec("DELETE FROM episode_ratings");
  console.log("Table cleared. Starting fresh upload.");

  const all = db
    .prepare("SELECT tconst, rating, votes FROM episode_ratings")
    .all() as Array<{ tconst: string; rating: number; votes: number }>;

  db.close();

  const BATCH = 500;
  let pushed = 0;

  for (let i = 0; i < all.length; i += BATCH) {
    const slice = all.slice(i, i + BATCH);
    const placeholders = slice.map(() => "(?, ?, ?)").join(", ");
    const args = slice.flatMap((r) => [r.tconst, r.rating, r.votes]);
    await tursoExec(
      `INSERT OR REPLACE INTO episode_ratings (tconst, rating, votes) VALUES ${placeholders}`,
      args
    );
    pushed += slice.length;
    if (pushed % 25_000 === 0 || pushed === all.length) {
      process.stdout.write(`\r  pushed ${pushed.toLocaleString()} / ${all.length.toLocaleString()} rows`);
    }
  }

  console.log(`\n✅  Done — ${pushed.toLocaleString()} rows uploaded to Turso`);
}

main().catch((err) => {
  console.error("\n❌", err.message);
  process.exit(1);
});
