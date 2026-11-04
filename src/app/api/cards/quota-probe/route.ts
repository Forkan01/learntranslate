import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { allowSameOriginWrite } from "@/lib/cards/same-origin-write";
import { verifyGenerationUser } from "@/lib/cards/verified-generation-user";
import { reserveGenerationAttempt } from "@/lib/cards/generation-budget";
import { reserveVerifiedProbeBurst } from "@/lib/cards/verified-probe-burst";

/**
 * V1-G.5C.2 — quota integration gate, intentionally NOT a public generation route.
 * Disabled by default, even if the private admin generation route is enabled.
 * A successful request reserves a quota slot but never invokes Gemini.
 */
export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  if (process.env.ENABLE_VERIFIED_QUOTA_PROBE !== "true") {
    return NextResponse.json({ error: "Quota probe disabled" }, { status: 503, headers });
  }
  if (!allowSameOriginWrite(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  const access = request.cookies.get("lt_auth_access")?.value;
  if (!access) return NextResponse.json({ error: "Sign in required" }, { status: 401, headers });
  const user = await verifyGenerationUser(access);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401, headers });
  // Derive actor from a server-verified user UUID. Never accept caller-supplied actor IDs.
  const actorId = createHash("sha256").update("lt:verified-user:" + user.id).digest("hex");
  const burst = await reserveVerifiedProbeBurst(actorId);
  if (burst === "limited") return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { ...headers, "Retry-After": "10" } });
  if (burst !== "allowed") return NextResponse.json({ error: "Abuse protection unavailable" }, { status: 503, headers });
  const admission = await reserveGenerationAttempt(actorId);
  if (admission === "limited") return NextResponse.json({ error: "Quota reached" }, { status: 429, headers: { ...headers, "Retry-After": "120" } });
  if (admission !== "allowed") return NextResponse.json({ error: "Quota service unavailable" }, { status: 503, headers });
  return NextResponse.json({ admitted: true, generated: false }, { headers });
}
