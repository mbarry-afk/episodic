import { getShow } from "@/lib/omdb";
import type { Show } from "@/lib/omdb";
import { SearchSection } from "@/components/SearchSection";

// Update this list to change what appears below the search bar.
const POPULAR_IDS = [
  "tt11280740", // Severance
  "tt14452776", // The Bear
  "tt10986410", // The White Lotus
  "tt11198330", // House of the Dragon
];

export default async function Home() {
  const shows = (
    await Promise.all(POPULAR_IDS.map((id) => getShow(id)))
  ).filter((s): s is Show => s !== null);

  return <SearchSection popularShows={shows} />;
}
