/**
 * Async access to the hosted Turso (libSQL) episode ratings database.
 * Exports getBatchImdbRatings() for efficient per-season lookups.
 * Returns an empty Map gracefully when env vars are not set.
 */

import { createClient, type Client } from "@libsql/client";

// ---------------------------------------------------------------------------
// Singleton client
// ---------------------------------------------------------------------------

let _client: Client | null | undefined; // undefined = not yet initialised

function getClient(): Client | null {
  if (_client !== undefined) return _client;

  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    _client = null;
    return null;
  }

  _client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  return _client;
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
 * Batch-look up ratings for a list of episode tconsts.
 * Returns a Map keyed by tconst — missing entries mean no rating found.
 * Returns an empty Map if the database is not configured.
 */
export async function getBatchImdbRatings(
  tconsts: string[]
): Promise<Map<string, ImdbRating>> {
  const map = new Map<string, ImdbRating>();
  if (tconsts.length === 0) return map;

  const db = getClient();
  if (!db) return map;

  try {
    const placeholders = tconsts.map(() => "?").join(", ");
    const result = await db.execute({
      sql: `SELECT tconst, rating, votes FROM episode_ratings WHERE tconst IN (${placeholders})`,
      args: tconsts,
    });

    for (const row of result.rows) {
      const tconst = row[0] as string;
      const rating = row[1] as number;
      const votes = row[2] as number;
      map.set(tconst, {
        rating,
        votes: votes.toLocaleString("en-US"),
      });
    }
  } catch {
    // Graceful degradation — return whatever we have so far
  }

  return map;
}
