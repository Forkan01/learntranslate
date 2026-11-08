import "server-only";
import { validateAdminCardsPage } from "./card-list.mjs";
import {
  draftReadUrl, draftPatchUrl, validDraftId, parseDraftChanges,
  confirmDraftPatch, nextDraftVersion,
  type EditableDraft,
} from "./edit-draft.mjs";

export class DraftEditUnavailable extends Error {}
export class DraftEditConflict extends Error {}

/** This module is never imported into client-side code. */
function config() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key || key.length > 4096) throw new DraftEditUnavailable();
  return { base, key };
}
function headers(key: string) {
  return { apikey: key, Authorization: "Bearer " + key };
}

export async function loadEditableDraft(id: string): Promise<EditableDraft | null> {
  if (process.env.ENABLE_LEARNTRANSLATE_ADMIN_REVIEW_READ !== "true")
    throw new DraftEditUnavailable();
  if (!validDraftId(id)) return null;
  const { base, key } = config();
  try {
    const url = draftReadUrl(base, id);
    const response = await fetch(url, {
      headers: headers(key), cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Read rejected");
    const raw: unknown = await response.json();
    const { cards } = validateAdminCardsPage(raw, { status: "draft", type: "all", offset: 0 });
    if (cards.length > 1) throw new Error("Nonunique ID");
    return cards.length ? cards[0] as EditableDraft : null;
  } catch {
    throw new DraftEditUnavailable();
  }
}

/**
 * Content-only, version-locked patch. Status, identity, search key, and
 * category associations are never in the update body.
 */
export async function updateEditableDraft(id: string, requestBody: unknown) {
  if (process.env.ENABLE_LEARNTRANSLATE_ADMIN_DRAFT_EDIT !== "true")
    throw new DraftEditUnavailable();
  const stored = await loadEditableDraft(id);
  if (!stored) return null;
  const changes = parseDraftChanges(requestBody, stored);
  if (!changes) return { kind: "invalid" as const };
  if (changes.expectedUpdatedAt !== stored.updatedAt) throw new DraftEditConflict();
  const { base, key } = config();
  const url = draftPatchUrl(base, id, stored.updatedAt);
  const updated_at = nextDraftVersion(stored.updatedAt);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "PATCH",
      headers: {
        ...headers(key), "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ content: changes.content, updated_at }),
      cache: "no-store", signal: AbortSignal.timeout(8000),
    });
  } catch {
    // A timeout may have occurred AFTER the write; never auto-retry.
    throw new DraftEditUnavailable();
  }
  if (!response.ok) throw new DraftEditUnavailable();
  try {
    const rows: unknown = await response.json();
    if (Array.isArray(rows) && rows.length === 0) throw new DraftEditConflict();
    const confirmed = confirmDraftPatch(rows, stored);
    if (!confirmed) throw new DraftEditUnavailable();
    return { kind: "saved" as const, draft: confirmed };
  } catch (error) {
    if (error instanceof DraftEditConflict) throw error;
    throw new DraftEditUnavailable();
  }
}
