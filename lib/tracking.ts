/**
 * Page-view tracking backed by the same Turso database as IMDb ratings.
 * Table is created on first use (CREATE TABLE IF NOT EXISTS).
 */

import { createClient, type Client } from "@libsql/client";

let _client: Client | null | undefined;

function getClient(): Client | null {
  if (_client !== undefined) return _client;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) { _client = null; return null; }
  _client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  return _client;
}

// Ensure the table exists — idempotent, safe to call on every cold start.
let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  const db = getClient();
  if (!db) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS page_views (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      slug     TEXT NOT NULL,
      title    TEXT NOT NULL,
      viewed_at TEXT NOT NULL
    )
  `);
  tableReady = true;
}

export async function recordView(slug: string, title: string) {
  const db = getClient();
  if (!db) return;
  await ensureTable();
  await db.execute({
    sql: "INSERT INTO page_views (slug, title, viewed_at) VALUES (?, ?, ?)",
    args: [slug, title, new Date().toISOString()],
  });
}

export interface ShowStat {
  slug: string;
  title: string;
  views: number;
}

export async function getWeeklyStats(): Promise<{ total: number; shows: ShowStat[] }> {
  const db = getClient();
  if (!db) return { total: 0, shows: [] };
  await ensureTable();

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const totalResult = await db.execute({
    sql: "SELECT COUNT(*) AS n FROM page_views WHERE viewed_at >= ?",
    args: [since],
  });
  const total = Number(totalResult.rows[0]?.[0] ?? 0);

  const showResult = await db.execute({
    sql: `SELECT slug, title, COUNT(*) AS views
          FROM page_views
          WHERE viewed_at >= ?
          GROUP BY slug
          ORDER BY views DESC
          LIMIT 10`,
    args: [since],
  });

  const shows: ShowStat[] = showResult.rows.map((r) => ({
    slug: r[0] as string,
    title: r[1] as string,
    views: Number(r[2]),
  }));

  return { total, shows };
}
