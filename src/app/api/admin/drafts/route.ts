import { NextRequest, NextResponse } from "next/server";
import { resolveAdminAccess } from "@/lib/admin/server-admin-access";
import { allowSameOriginWrite } from "@/lib/cards/same-origin-write";
import { readBoundedJson } from "@/lib/cards/bounded-json";
import { parseNewAdminDraft } from "@/lib/admin/create-draft.mjs";
import {
  insertAdminDraft, AdminDraftAlreadyExists, AdminDraftStorageUnavailable,
} from "@/lib/admin/server-create-draft";

const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };
function denied(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers });
}

/** Creates unpublished drafts only. No unverified identity, caller-provided status, or public writes. */
export async function POST(request: NextRequest) {
  const access = await resolveAdminAccess(request);
  if (access === "disabled") return denied(404, "Not available");
  if (access === "unauthenticated") return denied(401, "Sign in required");
  if (access !== "allowed") return denied(403, "Not authorized");
  if (!allowSameOriginWrite(request)) return denied(403, "Invalid origin");
  if (process.env.ENABLE_LEARNTRANSLATE_ADMIN_DRAFT_WRITE !== "true")
    return denied(404, "Draft creation disabled");
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    return denied(415, "JSON required");
  let raw: unknown;
  try { raw = await readBoundedJson(request, 16384); }
  catch { return denied(400, "Invalid request"); }
  const row = parseNewAdminDraft(raw);
  if (!row) return denied(400, "Invalid draft fields");
  try {
    const result = await insertAdminDraft(row);
    return NextResponse.json({ draft: result }, { status: 201, headers });
  } catch (error) {
    if (error instanceof AdminDraftAlreadyExists) return denied(409, "A card with this term already exists");
    if (error instanceof AdminDraftStorageUnavailable) return denied(503, "Draft creation unavailable");
    return denied(503, "Draft creation unavailable");
  }
}
