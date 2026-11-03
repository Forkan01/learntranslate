import { NextResponse } from "next/server";
import { makeCardSearchKey, type CardLanguage, type CardType } from "@/lib/cards/schema";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const term = p.get("term") ?? "";
  const source = p.get("source") ?? "de";
  const target = p.get("target") ?? "en";
  const type = p.get("type") ?? "word";
  if (!term.trim() || term.length > 250 || !["de", "en"].includes(source) ||
      !["de", "en"].includes(target) || source === target ||
      !["word", "sentence"].includes(type)) {
    return NextResponse.json({ error: "Invalid search parameters" }, { status: 400 });
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const searchKey = makeCardSearchKey(term, source as CardLanguage, target as CardLanguage, type as CardType);
  const url = new URL("/rest/v1/cards", base);
  url.searchParams.set("select", "id,search_key,content,created_at,updated_at");
  url.searchParams.set("search_key", "eq." + searchKey);
  url.searchParams.set("status", "eq.published");
  url.searchParams.set("limit", "1");
  try {
    const response = await fetch(url, {
      headers: { apikey: key, Authorization: "Bearer " + key },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Lookup failed");
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error("Invalid response");
    return NextResponse.json({ found: rows.length > 0, card: rows[0] ?? null }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Lookup unavailable" }, { status: 503 });
  }
}
