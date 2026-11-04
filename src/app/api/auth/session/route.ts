import { NextRequest, NextResponse } from "next/server";
import { verifyGenerationUser } from "@/lib/cards/verified-generation-user";

const ACCESS = "lt_auth_access";
const REFRESH = "lt_auth_refresh";
const COOKIE = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };
function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const expected = process.env.NEXT_PUBLIC_APP_URL || "https://learntranslate.vercel.app";
  try { return !!origin && new URL(origin).origin === new URL(expected).origin; }
  catch { return false; }
}
function authConfig() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) return null;
  try {
    const url = new URL(base);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    return { url: url.origin, key };
  } catch { return null; }
}
function clearCookies(response: NextResponse) {
  response.cookies.set(ACCESS, "", { ...COOKIE, maxAge: 0 });
  response.cookies.set(REFRESH, "", { ...COOKIE, maxAge: 0 });
}
function setCookies(response: NextResponse, access: string, refresh: string, expiresIn: number) {
  response.cookies.set(ACCESS, access, { ...COOKIE, maxAge: Math.min(Math.max(expiresIn - 30, 60), 3600) });
  response.cookies.set(REFRESH, refresh, { ...COOKIE, maxAge: 60 * 60 * 24 * 7 });
}
const noStore = { "Cache-Control": "no-store" };
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: noStore });
  const config = authConfig();
  if (!config) return NextResponse.json({ error: "Auth unavailable" }, { status: 503, headers: noStore });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { access_token: access, refresh_token: refresh, expires_in: expires } = body as Record<string, unknown>;
  if (typeof access !== "string" || access.length > 8192 || typeof refresh !== "string" ||
      refresh.length > 8192 || !refresh || typeof expires !== "number" || expires < 60 || expires > 86400)
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  const user = await verifyGenerationUser(access);
  if (!user) return NextResponse.json({ error: "Invalid session" }, { status: 401, headers: noStore });
  const response = NextResponse.json({ signedIn: true }, { headers: noStore });
  setCookies(response, access, refresh, expires);
  return response;
}
export async function GET(request: NextRequest) {
  const access = request.cookies.get(ACCESS)?.value;
  if (access) {
    const user = await verifyGenerationUser(access);
    if (user) return NextResponse.json({ signedIn: true }, { headers: noStore });
  }
  const refresh = request.cookies.get(REFRESH)?.value;
  const config = authConfig();
  if (!refresh || !config) {
    const response = NextResponse.json({ signedIn: false }, { headers: noStore });
    clearCookies(response); return response;
  }
  try {
    const response = await fetch(config.url + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { apikey: config.key, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
      cache: "no-store", signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("Refresh failed");
    const data: unknown = await response.json();
    if (!data || typeof data !== "object") throw new Error("Invalid response");
    const tokens = data as Record<string, unknown>;
    if (typeof tokens.access_token !== "string" || typeof tokens.refresh_token !== "string" ||
        typeof tokens.expires_in !== "number") throw new Error("Invalid tokens");
    if (!await verifyGenerationUser(tokens.access_token)) throw new Error("Invalid user");
    const result = NextResponse.json({ signedIn: true }, { headers: noStore });
    setCookies(result, tokens.access_token, tokens.refresh_token, tokens.expires_in);
    return result;
  } catch {
    const result = NextResponse.json({ signedIn: false }, { headers: noStore });
    clearCookies(result); return result;
  }
}
export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: noStore });
  const response = NextResponse.json({ signedIn: false }, { headers: noStore });
  clearCookies(response);
  return response;
}
