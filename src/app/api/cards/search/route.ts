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
    // Reverse English lookup for the initial German→English published collection.
    // Only exact translation senses are accepted; no fuzzy or substring matches.
    // This bounded fallback is suitable for the small curated V1 dataset.
    let match: Record<string, unknown> | undefined = row;
    if (!match && source === "en" && target === "de") {
      const reverseUrl = new URL("/rest/v1/cards", url.origin);
      reverseUrl.searchParams.set("select", "id,search_key,status,content,created_at,updated_at");
      reverseUrl.searchParams.set("source_language", "eq.de");
      reverseUrl.searchParams.set("target_language", "eq.en");
      reverseUrl.searchParams.set("type", "eq." + type);
      reverseUrl.searchParams.set("status", "eq.published");
      reverseUrl.searchParams.set("order", "term.asc");
      reverseUrl.searchParams.set("limit", "500");
      const reverseResponse = await fetch(reverseUrl, {
        headers: { apikey: key, Authorization: "Bearer " + key },
        cache: "no-store", signal: AbortSignal.timeout(8000),
      });
      if (!reverseResponse.ok) throw new Error("Reverse lookup failed");
      const reverseRows: unknown = await reverseResponse.json();
      if (!Array.isArray(reverseRows)) throw new Error("Invalid reverse response");
      const wanted = term.normalize("NFKC").trim().replace(/\\s+/gu, " ").toLocaleLowerCase("en-US");
      match = (reverseRows as Record<string, unknown>[]).find(candidate => {
        if (candidate.status !== "published" || typeof candidate.content !== "object" ||
            !candidate.content || Array.isArray(candidate.content)) return false;
        const content = candidate.content as Record<string, unknown>;
        if (content.type !== type || content.sourceLanguage !== "de" ||
            content.targetLanguage !== "en" || typeof content.translation !== "string") return false;
        return content.translation.split(";").some(sense =>
          sense.trim().normalize("NFKC").toLocaleLowerCase("en-US") === wanted);
      });
    }
    return NextResponse.json({ found: Boolean(match), card: match ?? null }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Lookup unavailable" }, { status: 503 });
  }
}
