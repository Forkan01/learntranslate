import "server-only";
import { makeBulkDraftUrl, confirmBulkDraftInsert } from "./bulk-drafts.mjs";
import type { AdminDraftRow } from "./create-draft.mjs";

export class BulkDraftStorageUnavailable extends Error {}
export class BulkDraftDuplicate extends Error {}

/**
 * Atomic multi-row draft INSERT through PostgREST.
 * Explicitly no upsert, update, category linking or publishing.
 */
export async function insertBulkAdminDrafts(rows: AdminDraftRow[]): Promise<{count:number}> {
  if (process.env.ENABLE_LEARNTRANSLATE_ADMIN_DRAFT_WRITE !== "true" ||
      process.env.ENABLE_LEARNTRANSLATE_ADMIN_BULK_DRAFT_WRITE !== "true")
    throw new BulkDraftStorageUnavailable("Bulk writes disabled");
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 20 ||
      rows.some(row => row.status !== "draft"))
    throw new BulkDraftStorageUnavailable("Invalid draft batch");
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key || key.length > 4096)
    throw new BulkDraftStorageUnavailable("Admin database unavailable");
  let url: URL;
  try { url = makeBulkDraftUrl(base); }
  catch { throw new BulkDraftStorageUnavailable("Invalid database URL"); }
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
      body: JSON.stringify(rows),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    // Outcome might be uncertain after a timeout. Never auto-retry.
    throw new BulkDraftStorageUnavailable("Bulk insert outcome uncertain; check drafts before retrying");
  }
  if (response.status === 409)
    throw new BulkDraftDuplicate("One or more cards already exist; no upsert");
  if (response.status !== 201)
    throw new BulkDraftStorageUnavailable("Database rejected bulk insert");
  try {
    const raw: unknown = await response.json();
    const checked = confirmBulkDraftInsert(raw, rows);
    if (!checked) throw new Error("Unexpected batch response");
    return checked;
  } catch {
    throw new BulkDraftStorageUnavailable("Bulk result uncertain; check drafts before retrying");
  }
}
