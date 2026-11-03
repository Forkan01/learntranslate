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
  let url: URL;
  try {
    const origin = new URL(base);
    if (origin.protocol !== "https:" || origin.username || origin.password) throw new Error("Invalid database URL");
    url = new URL("/rest/v1/cards", origin);
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
  const searchKey = makeCardSearchKey(term, source as CardLanguage, target as CardLanguage, type as CardType);
  url.searchParams.set("select", "id,search_key,status,content,created_at,updated_at");
  url.searchParams.set("search_key", "eq." + searchKey);
  url.searchParams.set("status", "eq.published");
  url.searchParams.set("limit", "1");
  try {
    const response = await fetch(url, {
      headers: { apikey: key, Authorization: "Bearer " + key },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Lookup failed");
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) throw new Error("Invalid response");
    const row = rows[0] as Record<string, unknown> | undefined;
    if (row && (row.status !== "published" || row.search_key !== searchKey ||
        typeof row.content !== "object" || row.content === null)) {
      throw new Error("Invalid card response");
    }
    return NextResponse.json({ found: Boolean(row), card: row ?? null }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Lookup unavailable" }, { status: 503 });
  }
}
