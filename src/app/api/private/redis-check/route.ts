import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { checkRedisConnectivity } from "@/lib/cards/redis-connectivity";

const headers = { "Cache-Control": "no-store" };
function matchesToken(actual: string | null, expected: string): boolean {
  if (!actual || !actual.startsWith("Bearer ")) return false;
  const provided = Buffer.from(actual.slice(7));
  const wanted = Buffer.from(expected);
  return provided.length === wanted.length && timingSafeEqual(provided, wanted);
}
/** Private, opt-in diagnostic. No public Redis health oracle. */
export async function POST(request: Request) {
  if (process.env.ENABLE_PRIVATE_REDIS_DIAGNOSTIC !== "true")
    return NextResponse.json({ error: "Disabled" }, { status: 404, headers });
  const expected = process.env.CARD_GENERATION_ADMIN_TOKEN;
  if (!expected || expected.length < 32 || !matchesToken(request.headers.get("authorization"), expected))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  if (request.headers.has("origin"))
    return NextResponse.json({ error: "Browser requests disabled" }, { status: 403, headers });
  const ok = await checkRedisConnectivity();
  return NextResponse.json({ redis: ok ? "reachable" : "unavailable" }, { status: ok ? 200 : 503, headers });
}
