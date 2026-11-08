import "server-only";
import { validateAdminCardsPage } from "./card-list.mjs";
import { validDraftId } from "./edit-draft.mjs";
import {
  parseReviewTransition, validatePublishableContent, reviewCardUrl,
  reviewPatchUrl, confirmReviewPatch, nextDraftVersion,
  type ReviewCard,
} from "./review-transition.mjs";

export class ReviewWorkflowUnavailable extends Error {}
export class ReviewWorkflowConflict extends Error {}
export class ReviewWorkflowInvalid extends Error {}
export class ReviewWorkflowIncomplete extends Error {}

/** Private service role never enters the browser. Role lacks status UPDATE until activated separately. */
function dbConfig() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key || key.length > 4096) throw new ReviewWorkflowUnavailable();
  return { base, key };
}
const authHeaders = (key: string) => ({ apikey: key, Authorization: "Bearer " + key });

async function readCard(id: string): Promise<ReviewCard | null> {
  if (!validDraftId(id)) return null;
  if (process.env.ENABLE_LEARNTRANSLATE_ADMIN_REVIEW_READ !== "true")
    throw new ReviewWorkflowUnavailable();
  const { base, key } = dbConfig();
  try {
    const response = await fetch(reviewCardUrl(base, id), {
      headers: authHeaders(key), cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Card unavailable");
    const raw: unknown = await response.json();
    const { cards } = validateAdminCardsPage(raw, { status: "all", type: "all", offset: 0 });
    if (cards.length > 1 || (cards[0] && cards[0].id !== id)) throw new Error("Invalid card response");
    return cards.length === 1 ? cards[0] as ReviewCard : null;
  } catch { throw new ReviewWorkflowUnavailable(); }
}

/**
 * All state transitions have an explicit allowlist and an atomic,
 * status+version-locked database filter. No content or identity updates.
 */
export async function applyAdminReviewTransition(id: string, rawBody: unknown) {
  if (process.env.ENABLE_LEARNTRANSLATE_ADMIN_REVIEW_WORKFLOW !== "true")
    throw new ReviewWorkflowUnavailable();
  const card = await readCard(id);
  if (!card) return null;
  const action = parseReviewTransition(rawBody, card);
  if (!action) throw new ReviewWorkflowInvalid();
  if (action.action === "publish" &&
      process.env.ENABLE_LEARNTRANSLATE_ADMIN_PUBLISH !== "true")
    throw new ReviewWorkflowUnavailable();
  if (action.expectedUpdatedAt !== card.updatedAt) throw new ReviewWorkflowConflict();
  if (action.action === "submit" || action.action === "publish") {
    const errors = validatePublishableContent(card);
    if (errors.length) throw new ReviewWorkflowIncomplete();
  }
  const { base, key } = dbConfig();
  const url = reviewPatchUrl(base, id, action.from, card.updatedAt);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "PATCH",
      headers: {
        ...authHeaders(key), "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        status: action.to,
        updated_at: nextDraftVersion(card.updatedAt),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // A write may have succeeded despite a timeout. Do not retry automatically.
    throw new ReviewWorkflowUnavailable();
  }
  if (!response.ok) throw new ReviewWorkflowUnavailable();
  try {
    const result: unknown = await response.json();
    if (Array.isArray(result) && result.length === 0) throw new ReviewWorkflowConflict();
    const confirmed = confirmReviewPatch(result, card, action.to);
    if (!confirmed) throw new ReviewWorkflowUnavailable();
    return confirmed;
  } catch (error) {
    if (error instanceof ReviewWorkflowConflict) throw error;
    throw new ReviewWorkflowUnavailable();
  }
}
