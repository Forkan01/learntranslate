import type { AdminDraftRow } from "./create-draft.mjs";

export type BulkPair = { term: string; translation: string };
export type BulkDraftRequest = {
  type: "word" | "sentence";
  sourceLanguage: "de" | "en";
  pairs: string;
};
export function splitBulkPairs(raw: unknown): BulkPair[] | null;
export function parseBulkDraftRequest(input: unknown): AdminDraftRow[] | null;
export function makeBulkDraftUrl(base: string): URL;
export function confirmBulkDraftInsert(raw: unknown, expected: AdminDraftRow[]): { count: number } | null;
