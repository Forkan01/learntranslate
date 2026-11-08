import { NextRequest, NextResponse } from "next/server";
import { resolveAdminAccess } from "@/lib/admin/server-admin-access";
import { allowSameOriginWrite } from "@/lib/cards/same-origin-write";
import { readBoundedJson } from "@/lib/cards/bounded-json";
import { validDraftId } from "@/lib/admin/edit-draft.mjs";
import {
  applyAdminReviewTransition, ReviewWorkflowUnavailable, ReviewWorkflowConflict,
  ReviewWorkflowInvalid, ReviewWorkflowIncomplete,
} from "@/lib/admin/server-review-transition";

type Context = { params: Promise<{ id: string }> };
const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };
const error = (status: number, message: string) =>
  NextResponse.json({ error: message }, { status, headers });

/** Explicit administrator-only action: never accept status from the browser. */
export async function POST(request: NextRequest, context: Context) {
  const access = await resolveAdminAccess(request);
  if (access === "disabled") return error(404, "Not available");
  if (access === "unauthenticated") return error(401, "Sign in required");
  if (access !== "allowed") return error(403, "Not authorized");
  if (!allowSameOriginWrite(request)) return error(403, "Invalid origin");
  if (process.env.ENABLE_LEARNTRANSLATE_ADMIN_REVIEW_WORKFLOW !== "true")
    return error(404, "Review workflow disabled");
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    return error(415, "JSON required");
  const { id } = await context.params;
  if (!validDraftId(id)) return error(404, "Card not found");
  let body: unknown;
  try { body = await readBoundedJson(request, 2048); }
  catch { return error(400, "Invalid request"); }
  try {
    const result = await applyAdminReviewTransition(id, body);
    if (!result) return error(404, "Card not found");
    return NextResponse.json({ card: result }, { status: 200, headers });
  } catch (e) {
    if (e instanceof ReviewWorkflowInvalid) return error(400, "Invalid status transition");
    if (e instanceof ReviewWorkflowIncomplete) return error(422, "Complete all required learning fields before review or publishing");
    if (e instanceof ReviewWorkflowConflict) return error(409, "Card was changed. Reload the dashboard.");
    if (e instanceof ReviewWorkflowUnavailable) return error(503, "Review transition unavailable or disabled");
    return error(503, "Review transition unavailable");
  }
}
