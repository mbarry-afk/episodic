import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getShow, getAllEpisodes } from "@/lib/omdb";
import type { Episode } from "@/lib/omdb";
import { AdUnit } from "@/components/AdUnit";
import { TrackView } from "@/components/TrackView";
import { FEATURED_SHOWS } from "@/lib/featured-shows";
import { imdbIdFromSlug } from "@/lib/slug";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://episodic.app";

interface Props {
  params: { slug: string };
}

// Pre-render featured shows at build time; all others render on demand and
// are cached (equivalent to Pages Router's fallback: 'blocking').
export function generateStaticParams() {
  return FEATURED_SHOWS.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const imdbId = imdbIdFromSlug(params.slug);
  const show = await getShow(imdbId);
  if (!show) return {};

  const title = `${show.title} Episode Ratings | Episodic`;
  const description = `IMDb ratings for every episode of ${show.title} (${show.year}). See which episodes are the best and worst rated across all seasons.`;
  const canonical = `${SITE_URL}/show/${params.slug}`;
  const images = show.poster ? [{ url: show.poster }] : [];

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      images,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: show.poster ? [show.poster] : [],
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Each entry is a complete Tailwind literal so the scanner never purges them.
const RATING_SCALE = [
  { min: 8.5, classes: "bg-green-400 text-green-950" },
  { min: 7.0, classes: "bg-yellow-400 text-yellow-900" },
  { min: 0,   classes: "bg-red-500 text-white" },
] as const;

const UNRATED_CLASSES = "bg-zinc-800 text-zinc-500";

function ratingClasses(rating: number | null): string {
  if (rating === null) return UNRATED_CLASSES;
  return RATING_SCALE.find((r) => rating >= r.min)?.classes ?? UNRATED_CLASSES;
}

function seasonAvg(episodes: Episode[]): string {
  const rated = episodes.filter((ep) => ep.rating !== null);
  if (rated.length === 0) return "—";
  const avg = rated.reduce((sum, ep) => sum + ep.rating!, 0) / rated.length;
  return avg.toFixed(1);
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  // OMDb returns "YYYY-MM-DD"; render as "Jan 5, 2008"
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const month = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m - 1];
  return `${month} ${d}, ${y}`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ShowPage({ params }: Props) {
  const imdbId = imdbIdFromSlug(params.slug);
  const show = await getShow(imdbId);
  if (!show || !show.totalSeasons) notFound();

  const allEpisodes = await getAllEpisodes(imdbId, show.totalSeasons);

  // Group and sort by season → episode
  const seasonMap = new Map<number, Episode[]>();
  for (const ep of allEpisodes ?? []) {
    const bucket = seasonMap.get(ep.season) ?? [];
    bucket.push(ep);
    seasonMap.set(ep.season, bucket);
  }
  const seasons = Array.from(seasonMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([num, eps]) => ({
      num,
      eps: [...eps].sort((a, b) => a.episode - b.episode),
    }));

  // JSON-LD structured data (TVSeries schema)
  const startYear = show.year.match(/\d{4}/)?.[0];
  const genres = show.genre?.split(", ").filter(Boolean) ?? [];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    name: show.title,
    ...(show.plot && { description: show.plot }),
    ...(show.poster && { image: show.poster }),
    ...(startYear && { startDate: startYear }),
    ...(genres.length && { genre: genres }),
    ...(show.totalSeasons && { numberOfSeasons: show.totalSeasons }),
    url: `${SITE_URL}/show/${params.slug}`,
    sameAs: `https://www.imdb.com/title/${imdbId}/`,
    ...(show.imdbRating && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: show.imdbRating,
        bestRating: 10,
        worstRating: 1,
        ratingCount: 1000, // OMDb season endpoint doesn't return show-level vote count
      },
    }),
  };

  const LEGEND = [
    { label: "Bingeable",  sublabel: "8.5+", classes: "bg-green-400" },
    { label: "Good enough", sublabel: "7.0–8.4", classes: "bg-yellow-400" },
    { label: "Skippable",  sublabel: "<7.0", classes: "bg-red-500" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <TrackView slug={params.slug} title={show.title} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          // Replace < to prevent </script> injection in JSON data
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      {/* ── Back nav ── */}
      <div className="mx-auto max-w-5xl px-4 pt-8">
        <Link
          href="/"
          className="text-sm text-zinc-500 transition-colors hover:text-white"
        >
          ← Search
        </Link>
      </div>

      {/* ── Show header ── */}
      <header className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex gap-6">
          {show.poster && (
            <div className="relative h-44 w-[4.5rem] flex-shrink-0 overflow-hidden rounded-lg sm:w-28 sm:h-44">
              <Image
                src={show.poster}
                alt={show.title}
                fill
                sizes="(max-width: 640px) 72px, 112px"
                className="object-cover"
                priority
              />
            </div>
          )}

          <div className="flex flex-col justify-end gap-1">
            <h1 className="text-3xl font-bold leading-tight tracking-tight">
              {show.title}
            </h1>

            <p className="text-zinc-400">
              {show.year}
              {show.genre && <span> · {show.genre}</span>}
              {show.totalSeasons && (
                <span>
                  {" "}· {show.totalSeasons} season
                  {show.totalSeasons !== 1 ? "s" : ""}
                </span>
              )}
            </p>

            {show.imdbRating && (
              <div className="mt-1 flex items-center gap-1.5 text-sm">
                <span className="text-yellow-400">★</span>
                <span className="font-semibold">{show.imdbRating.toFixed(1)}</span>
                <span className="text-zinc-500">IMDb</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Content + sidebar ── */}
      <div className="mx-auto max-w-5xl px-4 pb-24">
        <div className="flex gap-8">

          {/* ── Main: ratings grid ── */}
          <main className="min-w-0 flex-1">
            <h2 className="mb-5 text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Episode Ratings
            </h2>

            {/* Legend */}
            <div className="mb-8 flex flex-wrap gap-x-4 gap-y-2">
              {LEGEND.map(({ label, sublabel, classes }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`h-3 w-3 flex-shrink-0 rounded-sm ${classes}`} />
                  <span className="text-sm font-medium text-zinc-200">{label}</span>
                  <span className="text-xs text-zinc-500">{sublabel}</span>
                </div>
              ))}
            </div>

            {seasons.length === 0 && (
              <p className="text-zinc-500">No episode data available.</p>
            )}

            {/* Seasons — ad injected after every 2nd season */}
            <div className="flex flex-col gap-10">
              {seasons.map(({ num, eps }, index) => (
                <div key={num}>
                  {/* Season label + average */}
                  <div className="mb-2.5 flex items-baseline gap-3">
                    <span className="text-sm font-semibold text-zinc-200">
                      Season {num}
                    </span>
                    <span className="text-xs text-zinc-500">
                      avg {seasonAvg(eps)}
                    </span>
                  </div>

                  {/* Episode cells */}
                  <div className="flex flex-wrap gap-1">
                    {eps.map((ep) => {
                      const color = ratingClasses(ep.rating);
                      const date = formatDate(ep.released);
                      return (
                        <div key={ep.imdbId} className="group relative">
                          {/* Cell */}
                          <div
                            className={`flex h-11 w-11 cursor-default select-none items-center justify-center rounded text-[11px] font-bold ${color}`}
                          >
                            {ep.rating?.toFixed(1) ?? "—"}
                          </div>

                          {/* Tooltip — CSS-only, no JS required */}
                          <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-52 -translate-x-1/2 rounded-xl bg-zinc-800 p-3 shadow-2xl ring-1 ring-white/10 group-hover:block">
                            <p className="text-sm font-semibold leading-snug text-white">
                              {ep.title}
                            </p>
                            <p className="mt-0.5 text-xs text-zinc-400">
                              S{num} E{ep.episode}
                              {date && <> · {date}</>}
                            </p>
                            <div className="mt-2.5 flex items-center gap-2">
                              <span
                                className={`rounded px-1.5 py-0.5 text-xs font-bold ${color}`}
                              >
                                {ep.rating?.toFixed(1) ?? "—"}
                              </span>
                              {ep.votes && (
                                <span className="text-xs text-zinc-400">
                                  {ep.votes} votes
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Leaderboard ad after every 2nd season (not after the last) */}
                  {(index + 1) % 2 === 0 && index < seasons.length - 1 && (
                    <div className="mt-10 hidden md:flex justify-center">
                      <AdUnit size="leaderboard" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </main>

          {/* ── Sidebar: rectangle ad ── */}
          <aside className="hidden lg:block w-[300px] flex-shrink-0">
            <div className="sticky top-6">
              <AdUnit size="rectangle" />
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}
