/**
 * Downloads IMDb episode + ratings datasets and builds a local SQLite database.
 * Run with:  npm run update-ratings
 *
 * Two files are fetched from IMDb (~20 MB + ~7 MB compressed):
 *   title.episode.tsv.gz  — every episode tconst with its parent show
 *   title.ratings.tsv.gz  — averageRating + numVotes for every rated title
 *
 * Strategy: stream both files line-by-line without loading them fully into
 * memory. Use SQLite as an intermediate store so the join can happen on disk
 * rather than in a JS Map (the episode file has ~8 million rows).
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import Database from "better-sqlite3";
import https from "https";
import zlib from "zlib";
import readline from "readline";
import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "imdb.db");

const EPISODES_URL = "https://datasets.imdbws.com/title.episode.tsv.gz";
const RATINGS_URL  = "https://datasets.imdbws.com/title.ratings.tsv.gz";

// ---------------------------------------------------------------------------
// Streaming helper
// ---------------------------------------------------------------------------

function streamTsv(
  url: string,
  onLine: (fields: string[]) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} from ${url}`));
          return;
        }
        const gunzip = zlib.createGunzip();
        const rl = readline.createInterface({
          input: res.pipe(gunzip),
          crlfDelay: Infinity,
        });
        let header = true;
        rl.on("line", (line) => {
          if (header) { header = false; return; } // skip TSV header row
          onLine(line.split("\t"));
        });
        rl.on("close", resolve);
        gunzip.on("error", reject);
      })
      .on("error", reject);
  });
}

// In-place progress counter — overwrites the same terminal line
function progress(label: string, n: number) {
  process.stdout.write(`\r  ${label} ${n.toLocaleString()} rows`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  // Remove stale DB so we always build fresh
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

  const db = new Database(DB_PATH);

  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("temp_store = MEMORY");

  db.exec(`
    CREATE TABLE episodes_temp (
      tconst TEXT PRIMARY KEY
    ) WITHOUT ROWID;

    CREATE TABLE episode_ratings (
      tconst  TEXT    PRIMARY KEY,
      rating  REAL    NOT NULL,
      votes   INTEGER NOT NULL
    ) WITHOUT ROWID;
  `);

  // ── Step 1: episode tconsts ───────────────────────────────────────────────
  // We only need the tconst column; we discard parentTconst/season/episode
  // because the lookup key at runtime is already the episode's tconst.

  console.log("\n⬇  Downloading episode list…");

  const insertEp = db.prepare(
    "INSERT OR IGNORE INTO episodes_temp (tconst) VALUES (?)"
  );
  const insertEpBatch = db.transaction((batch: string[]) => {
    for (const tconst of batch) insertEp.run(tconst);
  });

  let epCount = 0;
  let epBatch: string[] = [];

  await streamTsv(EPISODES_URL, ([tconst]) => {
    if (!tconst || !tconst.startsWith("tt")) return;
    epBatch.push(tconst);
    if (epBatch.length >= 10_000) {
      insertEpBatch(epBatch);
      epBatch = [];
    }
    if (++epCount % 250_000 === 0) progress("episodes:", epCount);
  });

  if (epBatch.length) insertEpBatch(epBatch);
  console.log(`\r  ✓ ${epCount.toLocaleString()} episodes indexed`);

  // ── Step 2: ratings (only for episode tconsts) ────────────────────────────

  console.log("⬇  Downloading ratings…");

  const insertRating = db.prepare(`
    INSERT INTO episode_ratings (tconst, rating, votes)
    SELECT ?, ?, ?
    WHERE EXISTS (SELECT 1 FROM episodes_temp WHERE tconst = ?)
  `);
  const insertRatingBatch = db.transaction(
    (batch: Array<[string, number, number]>) => {
      for (const [tconst, rating, votes] of batch) {
        insertRating.run(tconst, rating, votes, tconst);
      }
    }
  );

  let ratingCount = 0;
  let ratingBatch: Array<[string, number, number]> = [];

  await streamTsv(RATINGS_URL, ([tconst, ratingStr, votesStr]) => {
    const rating = parseFloat(ratingStr);
    const votes  = parseInt(votesStr, 10);
    if (!tconst || isNaN(rating) || isNaN(votes)) return;

    ratingBatch.push([tconst, rating, votes]);
    if (ratingBatch.length >= 5_000) {
      insertRatingBatch(ratingBatch);
      ratingBatch = [];
    }
    if (++ratingCount % 100_000 === 0) progress("ratings:", ratingCount);
  });

  if (ratingBatch.length) insertRatingBatch(ratingBatch);
  console.log(`\r  ✓ ${ratingCount.toLocaleString()} ratings processed`);

  // ── Step 3: clean up and optimise ─────────────────────────────────────────

  db.exec("DROP TABLE episodes_temp; ANALYZE;");

  const { n } = db
    .prepare("SELECT COUNT(*) AS n FROM episode_ratings")
    .get() as { n: number };

  console.log(`\n✅  Local DB — ${n.toLocaleString()} episode ratings stored`);
  console.log(`   ${DB_PATH}`);

  // ── Phase 2: push to Turso ────────────────────────────────────────────────

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (!tursoUrl) {
    console.log("\n⚠️  TURSO_DATABASE_URL not set — skipping Turso upload.\n");
    db.close();
    return;
  }

  console.log("\n☁️  Pushing to Turso…");

  // Use the Turso HTTP pipeline API directly — avoids @libsql/client's
  // Node.js v24 ReadableStream incompatibility.
  const authToken = process.env.TURSO_AUTH_TOKEN ?? "";
  const apiBase = tursoUrl.replace(/^libsql:\/\//, "https://");

  async function tursoExec(sql: string, args: (string | number)[] = []) {
    const body = JSON.stringify({
      requests: [
        { type: "execute", stmt: { sql, args: args.map((v) => typeof v === "number" ? { type: "float", value: v } : { type: "text", value: v }) } },
        { type: "close" },
      ],
    });
    const res = await fetch(`${apiBase}/v2/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
      body,
    });
    if (!res.ok) throw new Error(`Turso HTTP ${res.status}: ${await res.text()}`);
  }

  // Create table and wipe existing data
  await tursoExec(`CREATE TABLE IF NOT EXISTS episode_ratings (tconst TEXT PRIMARY KEY, rating REAL NOT NULL, votes INTEGER NOT NULL)`);
  await tursoExec("DELETE FROM episode_ratings");

  // Read all rows from local SQLite
  const all = db
    .prepare("SELECT tconst, rating, votes FROM episode_ratings")
    .all() as Array<{ tconst: string; rating: number; votes: number }>;

  db.close();

  // Push in batches of 100 rows per HTTP request
  const TURSO_BATCH = 100;
  let pushed = 0;

  for (let i = 0; i < all.length; i += TURSO_BATCH) {
    const slice = all.slice(i, i + TURSO_BATCH);
    const placeholders = slice.map(() => "(?, ?, ?)").join(", ");
    const args = slice.flatMap((r) => [r.tconst, r.rating, r.votes]);
    await tursoExec(
      `INSERT OR REPLACE INTO episode_ratings (tconst, rating, votes) VALUES ${placeholders}`,
      args
    );
    pushed += slice.length;
    if (pushed % 50_000 === 0 || pushed === all.length) {
      progress("pushed:", pushed);
    }
  }

  console.log(`\n✅  Turso — ${pushed.toLocaleString()} rows uploaded\n`);
}

main().catch((err) => {
  console.error("\n❌ ", err.message);
  process.exit(1);
});
