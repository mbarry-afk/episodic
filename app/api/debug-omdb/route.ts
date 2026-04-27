import { NextResponse } from "next/server";
import { getShow } from "@/lib/omdb";

export async function GET() {
  const keySet = !!process.env.OMDB_API_KEY;

  if (!keySet) {
    return NextResponse.json({ OMDB_API_KEY: false, show: null, error: "OMDB_API_KEY not set" });
  }

  // Test with Breaking Bad — always exists in OMDb
  const show = await getShow("tt0903747");

  return NextResponse.json({
    OMDB_API_KEY: true,
    show: show ? { title: show.title, totalSeasons: show.totalSeasons } : null,
    error: show ? null : "getShow returned null — OMDb API rejected the request",
  });
}
