import { normalizeSearchTerm } from "./schema";

// Match a complete sentence regardless of its final punctuation.
// Internal punctuation and all words remain significant.
export function normalizeSentenceLookup(value: string, language: "de" | "en"): string {
  return normalizeSearchTerm(value, language).replace(/[.!?。！？]+$/u, "").trimEnd();
}
export function sentenceLookupMatches(query: string, stored: string, language: "de" | "en"): boolean {
  const wanted = normalizeSentenceLookup(query, language);
  return wanted.length > 0 && wanted === normalizeSentenceLookup(stored, language);
}
