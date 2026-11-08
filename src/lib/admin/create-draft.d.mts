/**
 * TypeScript contract for the runtime-validated JavaScript draft parser.
 * Only parseNewAdminDraft can construct this database row from unknown input.
 * Keep this declaration synchronized with create-draft.mjs and its tests.
 */
export type AdminDraftRow = {
  type: "word" | "sentence";
  source_language: "de" | "en";
  target_language: "de" | "en";
  term: string;
  search_key: string;
  status: "draft";
  content: Record<string, unknown>;
};

export type AdminDraftInsertResult = {
  id: string;
  status: "draft";
  type: "word" | "sentence";
  term: string;
};

/** Returns null unless the complete untrusted request passes validation. */
export function parseNewAdminDraft(value: unknown): AdminDraftRow | null;

/** Resolves the privileged REST endpoint from a strict HTTPS origin. */
export function makeAdminDraftUrl(base: string): URL;

/** Returns null unless PostgREST confirms exactly one matching draft. */
export function confirmDraftInsert(
  value: unknown,
  expected: Pick<AdminDraftRow, "type" | "term">,
): AdminDraftInsertResult | null;
