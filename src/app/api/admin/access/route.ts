import { NextRequest, NextResponse } from "next/server";
import { resolveAdminAccess } from "@/lib/admin/server-admin-access";

// This endpoint exposes only an authorization result, never an admin ID,
// account details, unpublished cards, database secrets or write operations.
const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
};

export async function GET(request: NextRequest) {
  const access = await resolveAdminAccess(request);
  if (access === "disabled")
    return NextResponse.json({ authorized: false }, { status: 404, headers });
  if (access === "unauthenticated")
    return NextResponse.json({ authorized: false }, { status: 401, headers });
  if (access === "forbidden")
    return NextResponse.json({ authorized: false }, { status: 403, headers });

  return NextResponse.json({ authorized: true }, { headers });
}
