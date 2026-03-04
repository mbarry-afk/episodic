import { NextRequest, NextResponse } from "next/server";
import { searchShows } from "@/lib/omdb";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json([]);
  }

  try {
    const results = await searchShows(query);
    return NextResponse.json(results ?? []);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
