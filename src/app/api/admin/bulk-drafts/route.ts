import { NextRequest, NextResponse } from "next/server";
import { resolveAdminAccess } from "@/lib/admin/server-admin-access";
import { allowSameOriginWrite } from "@/lib/cards/same-origin-write";
import { readBoundedJson } from "@/lib/cards/bounded-json";
import { parseBulkDraftRequest } from "@/lib/admin/bulk-drafts.mjs";
import {
  insertBulkAdminDrafts, BulkDraftDuplicate, BulkDraftStorageUnavailable,
} from "@/lib/admin/server-bulk-drafts";

const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };
const denied = (status: number, error: string) =>
  NextResponse.json({ error }, { status, headers });

/** Admin-only batch creation. Never publishes or modifies existing cards. */
export async function POST(request: NextRequest) {
  const access = await resolveAdminAccess(request);
  if (access === "disabled") return denied(404, "Not available");
  if (access === "unauthenticated") return denied(401, "Sign in required");
  if (access !== "allowed") return denied(403, "Not authorized");
  if (!allowSameOriginWrite(request)) return denied(403, "Invalid origin");
  if (process.env.ENABLE_LEARNTRANSLATE_ADMIN_DRAFT_WRITE !== "true" ||
      process.env.ENABLE_LEARNTRANSLATE_ADMIN_BULK_DRAFT_WRITE !== "true")
    return denied(404, "Bulk draft import disabled");
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    return denied(415, "JSON required");
  let body: unknown;
  try { body = await readBoundedJson(request, 20000); }
  catch { return denied(400, "Invalid bulk import request"); }
  const rows = parseBulkDraftRequest(body);
  if (!rows) return denied(400, "Invalid pairs, duplicate terms, or batch limit exceeded");
  try {
    const result = await insertBulkAdminDrafts(rows);
    return NextResponse.json({ created: result.count, status: "draft" }, { status: 201, headers });
  } catch (error) {
    if (error instanceof BulkDraftDuplicate)
      return denied(409, "At least one card already exists. No cards were overwritten.");
    if (error instanceof BulkDraftStorageUnavailable)
      return denied(503, "Bulk insert could not be verified. Check Drafts before retrying.");
    return denied(503, "Bulk insert unavailable. Check Drafts before retrying.");
  }
}
