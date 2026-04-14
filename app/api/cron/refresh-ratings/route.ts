/**
 * Cron route: refreshes IMDb episode ratings in Turso.
 * Triggered weekly by Vercel Cron (see vercel.json).
 * Protected by CRON_SECRET — Vercel sends it as a Bearer token automatically.
 *
 * Strategy (no SQLite / no native deps):
 *   1. Stream title.ratings.tsv.gz → load all ratings into a Map
 *   2. Stream title.episode.tsv.gz → collect tconsts that exist in the Map
 *   3. Bulk-upsert the matched rows into Turso via the HTTP pipeline API
 *
 * NOTE: requires Vercel Pro (maxDuration = 300s). On Hobby the limit is 60s
 * which is not enough for this pipeline (~2–4 minutes end-to-end).
 */

import { NextRequest, NextResponse } from "next/server";
import https from "https";
import zlib from "zlib";
import readline from "readline";

export const maxDuration = 300; // seconds — Vercel Pro required

const EPISODES_URL = "https://datasets.imdbws.com/title.episode.tsv.gz";
const RATINGS_URL  = "https://datasets.imdbws.com/title.ratings.tsv.gz";
const BATCH        = 500; // rows per Turso HTTP request

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function streamTsv(url: string, onLine: (fields: string[]) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
          return;
        }
        const gunzip = zlib.createGunzip();
        const rl = readline.createInterface({
          input: res.pipe(gunzip),
          crlfDelay: Infinity,
        });
        let header = true;
        rl.on("line", (line) => {
          if (header) { header = false; return; }
          onLine(line.split("\t"));
        });
        rl.on("close", resolve);
        gunzip.on("error", reject);
      })
      .on("error", reject);
  });
}

async function tursoExec(
  apiBase: string,
  authToken: string,
  sql: string,
  args: (string | number)[] = [],
  retries = 5,
) {
  const body = JSON.stringify({
    requests: [
      {
        type: "execute",
        stmt: {
          sql,
          args: args.map((v) =>
            typeof v === "number"
              ? { type: "float", value: v }
              : { type: "text", value: v },
          ),
        },
      },
      { type: "close" },
    ],
  });

  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(`${apiBase}/v2/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body,
    });
    if (res.ok) return;
    if (attempt === retries) {
      throw new Error(`Turso HTTP ${res.status}: ${await res.text()}`);
    }
    await new Promise((r) => setTimeout(r, attempt * 2_000));
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  // Auth — Vercel Cron sends CRON_SECRET as a Bearer token automatically
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN ?? "";
  if (!tursoUrl) {
    return NextResponse.json({ error: "TURSO_DATABASE_URL not set" }, { status: 500 });
  }
  const apiBase = tursoUrl.replace(/^libsql:\/\//, "https://");

  const started = Date.now();

  // ── Step 1: load ratings into memory ──────────────────────────────────────
  // title.ratings.tsv.gz is ~7 MB compressed, ~1.4 M rows — fits comfortably
  // in a Map without touching disk.
  const ratingsMap = new Map<string, { rating: number; votes: number }>();

  await streamTsv(RATINGS_URL, ([tconst, ratingStr, votesStr]) => {
    const rating = parseFloat(ratingStr);
    const votes  = parseInt(votesStr, 10);
    if (tconst && !isNaN(rating) && !isNaN(votes)) {
      ratingsMap.set(tconst, { rating, votes });
    }
  });

  // ── Step 2: stream episode list, keep only tconsts that have ratings ───────
  // title.episode.tsv.gz is ~20 MB compressed, ~8 M rows — streamed line by
  // line so memory stays flat regardless of file size.
  const episodeRatings: Array<{ tconst: string; rating: number; votes: number }> = [];

  await streamTsv(EPISODES_URL, ([tconst]) => {
    if (!tconst?.startsWith("tt")) return;
    const r = ratingsMap.get(tconst);
    if (r) episodeRatings.push({ tconst, ...r });
  });

  // ── Step 3: clear old data and upload to Turso ────────────────────────────
  await tursoExec(
    apiBase, authToken,
    `CREATE TABLE IF NOT EXISTS episode_ratings (
       tconst TEXT PRIMARY KEY,
       rating REAL NOT NULL,
       votes  INTEGER NOT NULL
     )`,
  );
  await tursoExec(apiBase, authToken, "DELETE FROM episode_ratings");

  let pushed = 0;
  for (let i = 0; i < episodeRatings.length; i += BATCH) {
    const slice       = episodeRatings.slice(i, i + BATCH);
    const placeholders = slice.map(() => "(?, ?, ?)").join(", ");
    const args         = slice.flatMap((r) => [r.tconst, r.rating, r.votes]);
    await tursoExec(
      apiBase, authToken,
      `INSERT OR REPLACE INTO episode_ratings (tconst, rating, votes) VALUES ${placeholders}`,
      args,
    );
    pushed += slice.length;
  }

  const elapsed = Math.round((Date.now() - started) / 1_000);

  return NextResponse.json({
    ok: true,
    rows: pushed,
    elapsed_s: elapsed,
    timestamp: new Date().toISOString(),
  });
}
