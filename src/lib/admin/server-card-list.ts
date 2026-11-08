import "server-only";
import { makeAdminCardsUrl, validateAdminCardsPage } from "./card-list.mjs";

export type AdminCardsQuery = {
  status: "all" | "draft" | "review" | "published" | "rejected";
  type: "all" | "word" | "sentence";
  offset: number;
};

export class AdminStorageUnavailable extends Error {}

/**
 * Reads all statuses only after the route has authenticated the administrator.
 * Never export a service-role credential or import this module into browser code.
 * This function does not insert, update, delete or publish any rows.
 */
export async function listAdminCards(query: AdminCardsQuery) {
  if (process.env.ENABLE_LEARNTRANSLATE_ADMIN_REVIEW_READ !== "true")
    throw new AdminStorageUnavailable("Admin review reads disabled");
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !serviceKey || serviceKey.length > 4096)
    throw new AdminStorageUnavailable("Admin database not configured");
  let url: URL;
  try { url = makeAdminCardsUrl(base, query); }
  catch { throw new AdminStorageUnavailable("Admin database configuration invalid"); }
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        apikey: serviceKey,
        Authorization: "Bearer " + serviceKey,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Admin database request failed");
    const rows: unknown = await response.json();
    return validateAdminCardsPage(rows, query);
  } catch {
    throw new AdminStorageUnavailable("Admin review list unavailable");
  }
}
