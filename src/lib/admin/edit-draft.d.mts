/**
 * Typed boundary for runtime-validated draft editing. Keep synchronized with edit-draft.mjs.
 */
export type EditableDraft = {
  id: string;
  type: "word" | "sentence";
  sourceLanguage: "de" | "en";
  targetLanguage: "de" | "en";
  term: string;
  status: "draft";
  updatedAt: string;
  content: Record<string, unknown>;
};
export type DraftChanges = {
  expectedUpdatedAt: string;
  content: Record<string, unknown>;
};
export function validDraftId(value: unknown): value is string;
export function validDraftVersion(value: unknown): value is string;
export function parseDraftChanges(body: unknown, stored: EditableDraft): DraftChanges | null;
export function draftReadUrl(base: string, id: string): URL;
export function draftPatchUrl(base: string, id: string, expectedUpdatedAt: string): URL;
export function confirmDraftPatch(raw: unknown, original: EditableDraft):
  { id: string; status: "draft"; updatedAt: string } | null;
export function nextDraftVersion(previous: string, now?: number): string;
