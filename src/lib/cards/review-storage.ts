import "server-only";
import { makeCardSearchKey, type LearningCardContent } from "./schema";
import { parseGeneratedCard } from "./generate";

type StorageResult = { stored: boolean; searchKey: string };
/**
 * Server-only review queue insertion. Not exposed as an HTTP route.
 * Requires a server-side Supabase service-role JWT and an explicit feature flag.
 * Never accepts a requested publication status.
 */
export async function queueGeneratedCardForReview(input: unknown): Promise<StorageResult> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid card");
  const value = input as Partial<LearningCardContent>;
  if (typeof value.term !== "string" || !["word", "sentence"].includes(String(value.type)) ||
      !["de", "en"].includes(String(value.sourceLanguage)) ||
      !["de", "en"].includes(String(value.targetLanguage)) ||
      value.sourceLanguage === value.targetLanguage) throw new Error("Invalid card identity");
  const card = parseGeneratedCard(input, {
    term: value.term,
    type: value.type as "word" | "sentence",
    source: value.sourceLanguage as "de" | "en",
    target: value.targetLanguage as "de" | "en",
  });
  if (!card) throw new Error("Card validation failed");
  const searchKey = makeCardSearchKey(card.term, card.sourceLanguage, card.targetLanguage, card.type);
  if (process.env.ENABLE_CARD_REVIEW_STORAGE !== "true") throw new Error("Review storage disabled");
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !secret) throw new Error("Review storage not configured");
  const origin = new URL(base);
  if (origin.protocol !== "https:" || origin.username || origin.password) throw new Error("Invalid database origin");
  const endpoint = new URL("/rest/v1/cards", origin);
  endpoint.searchParams.set("on_conflict", "search_key");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: secret,
      Authorization: "Bearer " + secret,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify({
      type: card.type, source_language: card.sourceLanguage,
      target_language: card.targetLanguage, term: card.term,
      search_key: searchKey, status: "review", content: card,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Review storage unavailable");
  return { stored: true, searchKey };
}
