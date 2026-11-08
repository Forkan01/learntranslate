import { NextRequest, NextResponse } from "next/server";
import { resolveAdminAccess } from "@/lib/admin/server-admin-access";
import { allowSameOriginWrite } from "@/lib/cards/same-origin-write";
import { readBoundedJson } from "@/lib/cards/bounded-json";
import { validDraftId } from "@/lib/admin/edit-draft.mjs";
import {
  loadEditableDraft, updateEditableDraft, DraftEditUnavailable, DraftEditConflict,
} from "@/lib/admin/server-edit-draft";

const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };
function failure(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers });
}
type Context = { params: Promise<{ id: string }> };

async function authorized(request: NextRequest) {
  return resolveAdminAccess(request);
}
function accessFailure(status: Awaited<ReturnType<typeof authorized>>) {
  if (status === "disabled") return failure(404, "Not available");
  if (status === "unauthenticated") return failure(401, "Sign in required");
  if (status !== "allowed") return failure(403, "Not authorized");
  return null;
}

/** GET returns only a private draft, never a published card. */
export async function GET(request: NextRequest, context: Context) {
  const rejected = accessFailure(await authorized(request));
  if (rejected) return rejected;
  if (process.env.ENABLE_LEARNTRANSLATE_ADMIN_REVIEW_READ !== "true")
    return failure(404, "Draft editor disabled");
  const { id } = await context.params;
  if (!validDraftId(id)) return failure(404, "Draft not found");
  try {
    const card = await loadEditableDraft(id);
    return card ? NextResponse.json({ draft: card }, { headers }) : failure(404, "Draft not found");
  } catch {
    return failure(503, "Draft read unavailable");
  }
}

/** PATCH accepts strictly bounded, same-origin editable fields only. */
export async function PATCH(request: NextRequest, context: Context) {
  const rejected = accessFailure(await authorized(request));
  if (rejected) return rejected;
  if (!allowSameOriginWrite(request)) return failure(403, "Invalid origin");
  if (process.env.ENABLE_LEARNTRANSLATE_ADMIN_DRAFT_EDIT !== "true")
    return failure(404, "Draft editing disabled");
  const { id } = await context.params;
  if (!validDraftId(id)) return failure(404, "Draft not found");
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    return failure(415, "JSON required");
  let body: unknown;
  try { body = await readBoundedJson(request, 16384); }
  catch { return failure(400, "Invalid request"); }
  try {
    const result = await updateEditableDraft(id, body);
    if (!result) return failure(404, "Draft not found");
    if (result.kind === "invalid") return failure(400, "Invalid draft fields");
    return NextResponse.json({ draft: result.draft }, { headers });
  } catch (error) {
    if (error instanceof DraftEditConflict) return failure(409, "Draft changed. Reload before saving.");
    if (error instanceof DraftEditUnavailable) return failure(503, "Draft save unavailable");
    return failure(503, "Draft save unavailable");
  }
}
