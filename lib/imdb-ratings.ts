/**
 * Read-only access to the local IMDb ratings SQLite database built by
 * `npm run update-ratings`. All functions return null gracefully if the
 * database file doesn't exist yet (e.g. on a fresh clone before first run).
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "imdb.db");

// ---------------------------------------------------------------------------
// Singleton connection — survives Next.js hot-reloads via the global object
// ---------------------------------------------------------------------------

type DbOrNull = Database.Database | null;
const g = global as typeof global & { __imdbDb?: DbOrNull };

function getDb(): DbOrNull {
  if ("__imdbDb" in g) return g.__imdbDb ?? null;

  if (!fs.existsSync(DB_PATH)) {
    // Database hasn't been built yet — degrade silently
    g.__imdbDb = null;
    return null;
  }

  try {
    g.__imdbDb = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  } catch {
    g.__imdbDb = null;
  }

  return g.__imdbDb;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ImdbRating {
  rating: number;
  /** Formatted with commas, e.g. "123,456" */
  votes: string;
}

/**
 * Look up an episode rating by its IMDb ID (tconst).
 * Returns null if the DB is missing or the episode has no rating.
 */
export function getImdbRating(tconst: string): ImdbRating | null {
  const db = getDb();
  if (!db) return null;

  try {
    const row = db
      .prepare("SELECT rating, votes FROM episode_ratings WHERE tconst = ?")
      .get(tconst) as { rating: number; votes: number } | undefined;

    if (!row) return null;

    return {
      rating: row.rating,
      votes: row.votes.toLocaleString("en-US"),
    };
  } catch {
    return null;
  }
}
