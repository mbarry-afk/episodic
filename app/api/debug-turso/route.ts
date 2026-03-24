import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";

export async function GET() {
  const urlSet = !!process.env.TURSO_DATABASE_URL;
  const tokenSet = !!process.env.TURSO_AUTH_TOKEN;

  if (!urlSet || !tokenSet) {
    return NextResponse.json({
      TURSO_DATABASE_URL: urlSet,
      TURSO_AUTH_TOKEN: tokenSet,
      count: null,
      error: "Missing env vars — cannot connect",
    });
  }

  try {
    const db = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });

    const result = await db.execute("SELECT COUNT(*) FROM episode_ratings");
    const count = result.rows[0][0];

    return NextResponse.json({
      TURSO_DATABASE_URL: urlSet,
      TURSO_AUTH_TOKEN: tokenSet,
      count,
      error: null,
    });
  } catch (err) {
    return NextResponse.json({
      TURSO_DATABASE_URL: urlSet,
      TURSO_AUTH_TOKEN: tokenSet,
      count: null,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
