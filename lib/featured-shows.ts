/**
 * Pre-rendered shows — built at deploy time and included in the sitemap.
 * Featured shows get clean title-only slugs (no IMDb ID in the URL).
 * Add new entries here to expand static coverage.
 */
export const FEATURED_SHOWS = [
  { imdbId: "tt0903747", slug: "breaking-bad" },
  { imdbId: "tt0944947", slug: "game-of-thrones" },
  { imdbId: "tt0141842", slug: "the-sopranos" },
  { imdbId: "tt0306414", slug: "the-wire" },
  { imdbId: "tt7366338", slug: "chernobyl" },
  { imdbId: "tt4074334", slug: "succession" },
  { imdbId: "tt1520211", slug: "the-walking-dead" },
  { imdbId: "tt0386676", slug: "the-office" },
  { imdbId: "tt2306299", slug: "vikings" },
  { imdbId: "tt4955642", slug: "the-good-place" },
] as const;
