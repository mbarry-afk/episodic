import { NextRequest, NextResponse } from "next/server";
import { recordView } from "@/lib/tracking";

export async function POST(req: NextRequest) {
  try {
    const { slug, title } = await req.json();
    if (!slug || !title) return NextResponse.json({ ok: false }, { status: 400 });
    await recordView(slug, title);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
