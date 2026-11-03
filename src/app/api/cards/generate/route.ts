import { NextResponse } from "next/server";
import { generateLearningCard } from "@/lib/cards/generate";
import type { CardLanguage, CardType } from "@/lib/cards/schema";

export async function POST(request: Request) {
  // Disabled by default: public unauthenticated generation can incur unbounded API cost.
  // Enable only in a controlled environment; rate limiting and persistence follow in V1-C.4.
  if (process.env.ENABLE_CARD_GENERATION !== "true") {
    return NextResponse.json({ error: "Card generation is not enabled" }, { status: 503 });
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { term, source, target, type } = body as Record<string, unknown>;
  if (typeof term !== "string" || !term.trim() || term.length > 250 ||
      !["de", "en"].includes(String(source)) || !["de", "en"].includes(String(target)) ||
      source === target || !["word", "sentence"].includes(String(type))) {
    return NextResponse.json({ error: "Invalid card request" }, { status: 400 });
  }
  try {
    const card = await generateLearningCard({
      term: term.trim(), source: source as CardLanguage, target: target as CardLanguage,
      type: type as CardType,
    });
    if (!card) return NextResponse.json({ error: "Card generation unavailable" }, { status: 503 });
    return NextResponse.json({ card, saved: false, status: "unsaved" }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Card generation unavailable" }, { status: 503 });
  }
}
