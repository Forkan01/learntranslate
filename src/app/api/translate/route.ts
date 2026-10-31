import { NextResponse } from "next/server";
import { translate } from "@/lib/translation";
import type { Language } from "@/lib/translation";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { text, source, target } = body as Record<string, unknown>;
  if (typeof text !== "string" || !text.trim() || text.length > 2000 || !["en", "de"].includes(String(source)) || !["en", "de"].includes(String(target)) || source === target) {
    return NextResponse.json({ error: "Invalid text or language pair" }, { status: 400 });
  }
  const result = await translate({ text, source: source as Language, target: target as Language });
  if (!result) return NextResponse.json({ error: "Translation unavailable", code: "UNAVAILABLE" }, { status: 503 });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
