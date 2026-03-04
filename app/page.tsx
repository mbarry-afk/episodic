"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Show } from "@/lib/omdb";
import { makeSlug } from "@/lib/slug";

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Show[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);

    if (!query.trim()) {
      setResults([]);
      setStatus("idle");
      return;
    }

    setStatus("loading");
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data: Show[] = await res.json();
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setStatus("done");
      }
    }, 300);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  const showEmpty = status === "done" && results.length === 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Search hero */}
      <div className="flex flex-col items-center px-4 pt-24 pb-10">
        <h1 className="mb-8 text-5xl font-bold tracking-tight text-white">
          Episodic
        </h1>
        <div className="relative w-full max-w-xl">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search TV shows…"
            autoFocus
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-4 text-lg text-white placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none"
          />
          {status === "loading" && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
              Searching…
            </span>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="mx-auto max-w-6xl px-4 pb-20">
        {showEmpty && (
          <p className="text-center text-zinc-500">
            No results for &ldquo;{query}&rdquo;
          </p>
        )}

        {results.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {results.map((show) => (
              <Link
                key={show.imdbId}
                href={`/show/${makeSlug(show.title, show.imdbId)}`}
                className="group flex flex-col overflow-hidden rounded-xl bg-zinc-900 transition-colors hover:bg-zinc-800"
              >
                {/* Poster */}
                <div className="relative aspect-[2/3] bg-zinc-800">
                  {show.poster ? (
                    <Image
                      src={show.poster}
                      alt={show.title}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                      className="object-cover transition-opacity group-hover:opacity-90"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-600">
                      No image
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">
                    {show.title}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">{show.year}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
