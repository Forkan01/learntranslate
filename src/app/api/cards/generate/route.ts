import { NextResponse } from "next/server";
import { generateLearningCard } from "@/lib/cards/generate";
import { reserveGenerationAttempt } from "@/lib/cards/generation-budget";
import type { CardLanguage, CardType } from "@/lib/cards/schema";

export async function POST(request: Request) {
  // Fail closed: even with generation enabled, this route is private-only.
  // Never put CARD_GENERATION_ADMIN_TOKEN in NEXT_PUBLIC_* or browser code.
  // Public generation requires a separate durable per-user quota and abuse controls.
  if (process.env.ENABLE_CARD_GENERATION !== "true") {
    return NextResponse.json({ error: "Card generation is not enabled" }, { status: 503 });
  }
  const expected = process.env.CARD_GENERATION_ADMIN_TOKEN;
  const authorization = request.headers.get("authorization");
  // A long random token is provisioned server-side only. Reject all public callers.
  if (!expected || expected.length < 32 || !authorization ||
      authorization !== "Bearer " + expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Disable caching and ensure browser origins cannot call this with credentials.
  if (request.headers.has("origin")) {
    return NextResponse.json({ error: "Browser generation disabled" }, { status: 403 });
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
  // Only authenticated private callers may supply this accounting label.
  // It is NOT a public user identity or authentication mechanism.
  const actorId = request.headers.get("x-lt-private-actor");
  if (!actorId || !/^[a-zA-Z0-9_-]{8,80}$/.test(actorId)) {
    return NextResponse.json({ error: "Private actor identifier required" }, { status: 400 });
  }
  const admission = await reserveGenerationAttempt(actorId);
  if (admission === "limited") {
    return NextResponse.json({ error: "Generation limit reached" }, {
      status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "120" },
    });
  }
  if (admission !== "allowed") {
    return NextResponse.json({ error: "Generation budget unavailable" }, { status: 503 });
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
