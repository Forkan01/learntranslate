import { NextRequest, NextResponse } from "next/server";
import { resolveAdminAccess } from "@/lib/admin/server-admin-access";
import { parseAdminListQuery } from "@/lib/admin/card-list.mjs";
import { listAdminCards } from "@/lib/admin/server-card-list";

const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };
const denied = (status: number) =>
  NextResponse.json({ error: "Not available" }, { status, headers });

/**
 * Privileged, read-only listing for the verified administrator. This route
 * NEVER accepts a user ID or token from headers, query/body, or localStorage.
 */
export async function GET(request: NextRequest) {
  const access = await resolveAdminAccess(request);
  if (access === "disabled") return denied(404);
  if (access === "unauthenticated") return denied(401);
  if (access !== "allowed") return denied(403);
  // Authorization MUST come before query parsing and privileged I/O.
  const query = parseAdminListQuery(request.nextUrl.searchParams);
  if (!query) return denied(400);
  try {
    const result = await listAdminCards(query);
    return NextResponse.json(result, { headers });
  } catch {
    return denied(503);
  }
}
