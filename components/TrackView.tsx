"use client";

import { useEffect } from "react";

interface Props {
  slug: string;
  title: string;
}

/**
 * Fires a single POST to /api/track on mount.
 * Renders nothing — purely a side-effect component.
 */
export function TrackView({ slug, title }: Props) {
  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, title }),
    }).catch(() => {});
  }, [slug, title]);

  return null;
}
