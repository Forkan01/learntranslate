import { NextResponse } from "next/server";
import { makeCardSearchKey, normalizeSearchTerm, type CardLanguage, type CardType } from "@/lib/cards/schema";

// Scan published cards in bounded pages rather than silently ignoring cards after row 500.
// A hard cap keeps public search requests from scanning an unbounded database.
const PAGE_SIZE = 500;
const MAX_PAGES = 10;
async function findPublishedFallback(
  url: URL, key: string, predicate: (row: Record<string, unknown>) => boolean
): Promise<Record<string, unknown> | undefined> {
  for (let page = 0; page < MAX_PAGES; page++) {
    const pageUrl = new URL(url);
    pageUrl.searchParams.set("offset", String(page * PAGE_SIZE));
    const response = await fetch(pageUrl, {
      headers: { apikey: key, Authorization: "Bearer " + key },
      cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Fallback lookup failed");
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) throw new Error("Invalid fallback response");
    const match = (rows as Record<string, unknown>[]).find(predicate);
    if (match) return match;
    if (rows.length < PAGE_SIZE) return undefined;
  }
  // Never report an unverified miss when the dataset exceeds our scan budget.
  throw new Error("Fallback scan limit exceeded");
}

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
    // Bounded pagination supports growth beyond the initial curated V1 dataset.
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
      const wanted = normalizeSearchTerm(term, "en");
      match = await findPublishedFallback(reverseUrl, key, candidate => {
        if (candidate.status !== "published" || typeof candidate.content !== "object" ||
            !candidate.content || Array.isArray(candidate.content)) return false;
        const content = candidate.content as Record<string, unknown>;
        if (content.type !== type || content.sourceLanguage !== "de" ||
            content.targetLanguage !== "en" || typeof content.translation !== "string") return false;
        return content.translation.split(";").some(sense =>
          normalizeSearchTerm(sense, "en") === wanted);
      });
    }
    // German noun lookup: accept an optional article, the exact singular,
    // or an explicitly curated plural. Never guess arbitrary inflections.
    if (!match && source === "de" && target === "en" && type === "word") {
      const wanted = normalizeSearchTerm(term, "de");
      const withoutArticle = wanted.replace(/^(?:der|die|das)\s+/u, "");
      const germanUrl = new URL("/rest/v1/cards", url.origin);
      germanUrl.searchParams.set("select", "id,search_key,status,content,created_at,updated_at");
      germanUrl.searchParams.set("source_language", "eq.de");
      germanUrl.searchParams.set("target_language", "eq.en");
      germanUrl.searchParams.set("type", "eq.word");
      germanUrl.searchParams.set("status", "eq.published");
      germanUrl.searchParams.set("order", "term.asc");
      germanUrl.searchParams.set("limit", "500");
      match = await findPublishedFallback(germanUrl, key, candidate => {
        if (candidate.status !== "published" || !candidate.content ||
            typeof candidate.content !== "object" || Array.isArray(candidate.content)) return false;
        const content = candidate.content as Record<string, unknown>;
        if (content.type !== "word" || content.sourceLanguage !== "de" ||
            content.targetLanguage !== "en" || typeof content.term !== "string") return false;
        const grammar = content.grammar;
        const noun = grammar && typeof grammar === "object" && !Array.isArray(grammar)
          ? grammar as Record<string, unknown> : null;
        const singular = normalizeSearchTerm(content.term, "de");
        const singularBare = singular.replace(/^(?:der|die|das)\s+/u, "");
        const article = noun?.article;
        const articleMatch = article === "der" || article === "die" || article === "das"
          ? wanted === article + " " + singularBare : false;
        // A supplied article must match the curated noun article; do not reuse
        // a card for an incorrect article (e.g. "der Katze" for "die Katze").
        const suppliedArticle = /^(der|die|das)\s+/u.exec(wanted)?.[1];
        const bareSingularMatch = !suppliedArticle && wanted === singularBare;
        const plural = noun?.partOfSpeech === "noun" && typeof noun.plural === "string"
          ? normalizeSearchTerm(noun.plural, "de") : "";
        const pluralMatch = plural !== "" && (
          wanted === plural || (!suppliedArticle && withoutArticle === plural)
        );
        return wanted === singular || bareSingularMatch || articleMatch || pluralMatch;
      });
    }
    return NextResponse.json({ found: Boolean(match), card: match ?? null }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Lookup unavailable" }, { status: 503 });
  }
}
