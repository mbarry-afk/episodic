import type { MetadataRoute } from "next";
import { FEATURED_SHOWS } from "@/lib/featured-shows";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://episodic.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const showUrls: MetadataRoute.Sitemap = FEATURED_SHOWS.map(({ slug }) => ({
    url: `${SITE_URL}/show/${slug}`,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [
    {
      url: SITE_URL,
      changeFrequency: "daily",
      priority: 1,
    },
    ...showUrls,
  ];
}
