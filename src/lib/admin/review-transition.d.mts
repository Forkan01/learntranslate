import type { AdminDraftInsertResult } from "./create-draft.mjs";

export type ReviewStatus = "draft" | "review" | "published" | "rejected";
export type ReviewAction = "submit" | "publish" | "reject" | "revise";
export type ReviewCard = {
  id: string;
  type: "word" | "sentence";
  sourceLanguage: "de" | "en";
  targetLanguage: "de" | "en";
  term: string;
  status: ReviewStatus;
  updatedAt: string;
  content: Record<string, unknown>;
};
export type ReviewTransition = {
  from: ReviewStatus;
  to: ReviewStatus;
  expectedUpdatedAt: string;
  action: ReviewAction;
};
export function validatePublishableContent(card: unknown): string[];
export function parseReviewTransition(body: unknown, card: ReviewCard): ReviewTransition | null;
export function reviewCardUrl(base: string, id: string): URL;
export function reviewPatchUrl(base: string, id: string, from: ReviewStatus, updatedAt: string): URL;
export function confirmReviewPatch(raw: unknown, card: ReviewCard, to: ReviewStatus):
  {id: string; status: ReviewStatus; updatedAt: string} | null;
export function nextDraftVersion(previous: string, now?: number): string;
