import { FEATURED_SHOWS } from "./featured-shows";

/**
 * Build the URL slug for a show.
 * Featured shows use a clean title-only slug (e.g. "breaking-bad").
 * All other shows embed the IMDb ID at the end (e.g. "suits-tt1632701")
 * so the ID can always be recovered without a database lookup.
 */
export function makeSlug(title: string, imdbId: string): string {
  const featured = FEATURED_SHOWS.find((s) => s.imdbId === imdbId);
  if (featured) return featured.slug;

  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${titleSlug}-${imdbId}`;
}

/**
 * Recover the IMDb ID from a slug.
 * Handles three formats:
 *   "breaking-bad"          → looks up in featured shows map
 *   "tt0903747"             → bare IMDb ID (old/direct links)
 *   "suits-tt1632701"       → extracts trailing IMDb ID
 */
export function imdbIdFromSlug(slug: string): string {
  const featured = FEATURED_SHOWS.find((s) => s.slug === slug);
  if (featured) return featured.imdbId;

  if (/^tt\d+$/.test(slug)) return slug;

  const match = slug.match(/(tt\d+)$/);
  return match ? match[1] : slug;
}
