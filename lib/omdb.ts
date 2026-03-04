import { getBatchImdbRatings } from "./imdb-ratings";

const BASE_URL = "https://www.omdbapi.com";

function apiKey(): string {
  const key = process.env.OMDB_API_KEY;
  if (!key) throw new Error("OMDB_API_KEY is not set");
  return key;
}

// Returns null for OMDb's sentinel "N/A" value
function val(s: string | undefined): string | null {
  return s && s !== "N/A" ? s : null;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Show {
  imdbId: string;
  title: string;
  year: string;
  poster: string | null;
  plot: string | null;
  genre: string | null;
  actors: string | null;
  imdbRating: number | null;
  totalSeasons: number | null;
}

export interface Episode {
  season: number;
  episode: number;
  imdbId: string;
  title: string;
  released: string | null;
  /** imdbRating as a number, or null if unaired / not yet rated */
  rating: number | null;
  /**
   * Vote count string (e.g. "123,456").
   * Null when fetched via the season endpoint — OMDb only returns votes
   * on individual episode lookups (?i=tt...).
   */
  votes: string | null;
}

export interface Season {
  season: number;
  episodes: Episode[];
}

// ---------------------------------------------------------------------------
// Raw OMDb response shapes (internal — not exported)
// ---------------------------------------------------------------------------

interface RawSearchItem {
  imdbID: string;
  Title: string;
  Year: string;
  Poster: string;
}

interface RawSearchResponse {
  Response: string;
  Search?: RawSearchItem[];
}

interface RawShow {
  Response: string;
  imdbID: string;
  Title: string;
  Year: string;
  Poster: string;
  Plot: string;
  Genre: string;
  Actors: string;
  imdbRating: string;
  totalSeasons: string;
}

interface RawEpisode {
  Episode: string;
  imdbID: string;
  Title: string;
  Released: string;
  imdbRating: string;
}

interface RawSeason {
  Response: string;
  Season: string;
  Episodes?: RawEpisode[];
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Search for TV series by title. Returns a simplified list of matches,
 * or null if nothing was found or the request failed.
 */
export async function searchShows(query: string): Promise<Show[] | null> {
  try {
    const url = `${BASE_URL}/?apikey=${apiKey()}&s=${encodeURIComponent(query)}&type=series`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;

    const data: RawSearchResponse = await res.json();
    if (data.Response === "False" || !data.Search) return null;

    return data.Search.map((item) => ({
      imdbId: item.imdbID,
      title: item.Title,
      year: item.Year,
      poster: val(item.Poster),
      // Fields not returned by the search endpoint
      plot: null,
      genre: null,
      actors: null,
      imdbRating: null,
      totalSeasons: null,
    }));
  } catch {
    return null;
  }
}

/**
 * Fetch full details for a single show by IMDb ID.
 * Returns null if the show wasn't found or the request failed.
 */
export async function getShow(imdbId: string): Promise<Show | null> {
  try {
    const url = `${BASE_URL}/?apikey=${apiKey()}&i=${imdbId}&plot=full`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;

    const data: RawShow = await res.json();
    if (data.Response === "False") return null;

    const rating = parseFloat(data.imdbRating);
    const seasons = parseInt(data.totalSeasons, 10);

    return {
      imdbId: data.imdbID,
      title: data.Title,
      year: data.Year,
      poster: val(data.Poster),
      plot: val(data.Plot),
      genre: val(data.Genre),
      actors: val(data.Actors),
      imdbRating: isNaN(rating) ? null : rating,
      totalSeasons: isNaN(seasons) ? null : seasons,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch all episodes for a given season.
 * Returns null if the season wasn't found or the request failed.
 */
export async function getSeason(
  imdbId: string,
  season: number
): Promise<Season | null> {
  try {
    const url = `${BASE_URL}/?apikey=${apiKey()}&i=${imdbId}&Season=${season}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;

    const data: RawSeason = await res.json();
    if (data.Response === "False" || !data.Episodes) return null;

    const parsed = data.Episodes.map((ep) => {
      const omdbRating = parseFloat(ep.imdbRating);
      return {
        season,
        episode: parseInt(ep.Episode, 10),
        imdbId: ep.imdbID,
        title: ep.Title,
        released: val(ep.Released),
        rating: isNaN(omdbRating) ? null : omdbRating,
      };
    });

    // For episodes missing an OMDb rating, batch-fetch from Turso in one query.
    const unrated = parsed.filter((ep) => ep.rating === null).map((ep) => ep.imdbId);
    const fallbacks = await getBatchImdbRatings(unrated);

    const episodes: Episode[] = parsed.map((ep) => {
      const fb = ep.rating === null ? fallbacks.get(ep.imdbId) : undefined;
      return {
        ...ep,
        rating: ep.rating ?? fb?.rating ?? null,
        votes: fb?.votes ?? null,
      };
    });

    return { season, episodes };
  } catch {
    return null;
  }
}

/**
 * Fetch every episode across all seasons in parallel.
 * Returns a flat array sorted by season then episode, or null on total failure.
 */
export async function getAllEpisodes(
  imdbId: string,
  totalSeasons: number
): Promise<Episode[] | null> {
  try {
    const seasonNums = Array.from({ length: totalSeasons }, (_, i) => i + 1);
    const seasons = await Promise.all(seasonNums.map((n) => getSeason(imdbId, n)));

    const episodes = seasons
      .filter((s): s is Season => s !== null)
      .flatMap((s) => s.episodes);

    return episodes.length > 0 ? episodes : null;
  } catch {
    return null;
  }
}
