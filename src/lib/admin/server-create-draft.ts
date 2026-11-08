import "server-only";
import { makeAdminDraftUrl, confirmDraftInsert } from "./create-draft.mjs";

export class AdminDraftStorageUnavailable extends Error {}
export class AdminDraftAlreadyExists extends Error {}

/**
 * An administrator-only, disabled-by-default INSERT into public.cards.
 * Only fixed draft status; no update, category mutation, publish or deletion.
 * Database role must be separately granted INSERT (SELECT already granted).
 */
export async function insertAdminDraft(row: {
  type: "word" | "sentence";
  source_language: "de" | "en";
  target_language: "de" | "en";
  term: string;
  search_key: string;
  status: "draft";
  content: Record<string, unknown>;
}) {
  if (process.env.ENABLE_LEARNTRANSLATE_ADMIN_DRAFT_WRITE !== "true")
    throw new AdminDraftStorageUnavailable("Draft writes disabled");
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key || key.length > 4096)
    throw new AdminDraftStorageUnavailable("Admin storage not configured");
  let url: URL;
  try { url = makeAdminDraftUrl(base); }
  catch { throw new AdminDraftStorageUnavailable("Invalid database configuration"); }
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(row),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // Never automatically retry ambiguous writes.
    throw new AdminDraftStorageUnavailable("Insert outcome uncertain");
  }
  if (response.status === 409) throw new AdminDraftAlreadyExists("Card already exists");
  if (response.status !== 201)
    throw new AdminDraftStorageUnavailable("Database denied draft insert");
  try {
    const raw: unknown = await response.json();
    const inserted = confirmDraftInsert(raw, row);
    if (!inserted) throw new Error("Unexpected insert result");
    return inserted;
  } catch {
    throw new AdminDraftStorageUnavailable("Insert result uncertain");
  }
}
