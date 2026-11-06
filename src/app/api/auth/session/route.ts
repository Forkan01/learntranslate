import { NextRequest, NextResponse } from "next/server";
import { verifyGenerationUser } from "@/lib/cards/verified-generation-user";
import { allowSameOriginWrite } from "@/lib/cards/same-origin-write";
import { singleFlightRefresh } from "@/lib/cards/refresh-singleflight";
import { readBoundedJson } from "@/lib/cards/bounded-json";
import { bindSessionTokenPair } from "@/lib/cards/bind-session-token-pair";
import { coordinateSecureRedisRefresh } from "@/lib/cards/secure-redis-refresh-adapter";
import { decideDistributedRefresh } from "@/lib/cards/distributed-refresh-decision";
import { issueSessionIdentityBinding, verifySessionIdentityBinding } from "@/lib/cards/session-identity-binding";

const ACCESS = "lt_auth_access";
const REFRESH = "lt_auth_refresh";
const IDENTITY = "lt_auth_identity";
function validRefresh(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 8192 &&
    /^[A-Za-z0-9._~-]+$/.test(value);
}
function validExpires(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 60 && value <= 86400;
}
const COOKIE = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };
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
  response.cookies.set(IDENTITY, "", { ...COOKIE, maxAge: 0 });
}
function setCookies(response: NextResponse, access: string, refresh: string, expiresIn: number) {
  response.cookies.set(ACCESS, access, { ...COOKIE, maxAge: Math.min(Math.max(expiresIn - 30, 1), 3600) });
  response.cookies.set(REFRESH, refresh, { ...COOKIE, maxAge: 60 * 60 * 24 * 7 });
}
// Optional until rollout: never change existing auth behavior when keys are absent.
async function setIdentityBinding(response: NextResponse, access: string, refresh: string): Promise<boolean> {
  const user = await verifyGenerationUser(access);
  const binding = user ? issueSessionIdentityBinding(user.id, refresh) : null;
  if (!binding) {
    response.cookies.set(IDENTITY, "", { ...COOKIE, maxAge: 0 });
    return false;
  }
  response.cookies.set(IDENTITY, binding, { ...COOKIE, maxAge: 60 * 60 * 24 * 7 });
  return true;
}
const noStore = { "Cache-Control": "no-store" };
class InvalidRefreshCredentialError extends Error {}
export async function POST(request: NextRequest) {
  if (!allowSameOriginWrite(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: noStore });
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    return NextResponse.json({ error: "JSON required" }, { status: 415, headers: noStore });
  const config = authConfig();
  if (!config) return NextResponse.json({ error: "Auth unavailable" }, { status: 503, headers: noStore });
  let body: unknown;
  try { body = await readBoundedJson(request, 16384); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: noStore }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { access_token: access, refresh_token: refresh, expires_in: expires } = body as Record<string, unknown>;
  if (typeof access !== "string" || access.length > 8192 || !validRefresh(refresh) || !validExpires(expires))
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  // A valid access token alone cannot authorize an unrelated refresh token.
  // Supabase rotates the refresh credential; persist only its returned pair.
  const bound = await bindSessionTokenPair(access, refresh, config);
  if (!bound) return NextResponse.json({ error: "Invalid session" }, { status: 401, headers: noStore });
  const response = NextResponse.json({ signedIn: true }, { headers: noStore });
  setCookies(response, bound.access, bound.refresh, bound.expires);
  await setIdentityBinding(response, bound.access, bound.refresh);
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
  if (!validRefresh(refresh)) {
    const response = NextResponse.json({ signedIn: false }, { headers: noStore });
    clearCookies(response); return response;
  }
  // Configuration failures are transient: retain refresh credentials for retry.
  if (!config) return NextResponse.json({ signedIn: false, retryable: true }, { status: 503, headers: noStore });
  // Experimental distributed refresh is disabled unless explicitly enabled.
  // Do not activate until identity binding and real multi-instance tests are complete.
  if (process.env.ENABLE_DISTRIBUTED_SESSION_REFRESH === "true") {
    const expectedUserId = verifySessionIdentityBinding(request.cookies.get(IDENTITY)?.value ?? "", refresh);
    if (!expectedUserId)
      return NextResponse.json({ signedIn: false, retryable: true }, { status: 503, headers: noStore });
    const outcome = await coordinateSecureRedisRefresh({
      refreshToken: refresh,
      verifyPair: async (pair) => (await verifyGenerationUser(pair.access))?.id === expectedUserId,
      refreshProvider: async () => {
        const provider = await fetch(config.url + "/auth/v1/token?grant_type=refresh_token", {
          method: "POST",
          headers: { apikey: config.key, "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refresh }),
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        if (!provider.ok) throw new Error("Refresh unavailable");
        const data: unknown = await provider.json();
        if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid provider response");
        const tokens = data as Record<string, unknown>;
        if (typeof tokens.access_token !== "string" || tokens.access_token.length > 8192 ||
            !validRefresh(tokens.refresh_token) || !validExpires(tokens.expires_in))
          throw new Error("Invalid provider tokens");
        return { access: tokens.access_token, refresh: tokens.refresh_token, expires: tokens.expires_in };
      },
    });
    const decision = decideDistributedRefresh(outcome);
    if (decision.kind !== "set")
      return NextResponse.json({ signedIn: false, retryable: true }, { status: 503, headers: noStore });
    const result = NextResponse.json({ signedIn: true }, { headers: noStore });
    const newBinding = issueSessionIdentityBinding(expectedUserId, decision.refresh);
    if (!newBinding)
      return NextResponse.json({ signedIn: false, retryable: true }, { status: 503, headers: noStore });
    setCookies(result, decision.access, decision.refresh, decision.expires);
    result.cookies.set(IDENTITY, newBinding, { ...COOKIE, maxAge: 60 * 60 * 24 * 7 });
    return result;
  }
  try {
    const tokens = await singleFlightRefresh(refresh, async () => {
      const response = await fetch(config.url + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { apikey: config.key, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
      cache: "no-store", signal: AbortSignal.timeout(5000),
    });
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw new InvalidRefreshCredentialError();
    }
    if (!response.ok) throw new Error("Refresh temporarily unavailable");
    const data: unknown = await response.json();
    if (!data || typeof data !== "object") throw new Error("Invalid response");
    const tokens = data as Record<string, unknown>;
    if (typeof tokens.access_token !== "string" || tokens.access_token.length > 8192 ||
        !validRefresh(tokens.refresh_token) || !validExpires(tokens.expires_in))
      throw new Error("Invalid tokens");
    if (!await verifyGenerationUser(tokens.access_token)) throw new Error("Invalid user");
      return { access: tokens.access_token, refresh: tokens.refresh_token, expires: tokens.expires_in };
    });
    const result = NextResponse.json({ signedIn: true }, { headers: noStore });
    setCookies(result, tokens.access, tokens.refresh, tokens.expires);
    await setIdentityBinding(result, tokens.access, tokens.refresh);
    return result;
  } catch (error) {
    if (error instanceof InvalidRefreshCredentialError) {
      // A different server instance may have already rotated this refresh token.
      // Never clear browser cookies based solely on a rejected refresh attempt:
      // an older response could otherwise erase a newer valid session.
      return NextResponse.json({ signedIn: false, retryable: true }, { status: 503, headers: noStore });
    }
    // Network failures, provider 5xx/429, and malformed provider responses
    // must not destroy a potentially valid session. Never claim signed-in.
    return NextResponse.json({ signedIn: false, retryable: true }, { status: 503, headers: noStore });
  }
}
export async function DELETE(request: NextRequest) {
  if (!allowSameOriginWrite(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: noStore });
  // Revoke the current Supabase session when possible, not just browser cookies.
  // A provider failure cannot be treated as successful server-side revocation.
  const access = request.cookies.get(ACCESS)?.value;
  const config = authConfig();
  let revoked = false;
  if (access && access.length <= 8192 && /^[A-Za-z0-9._~-]+$/.test(access) && config) {
    try {
      const provider = await fetch(config.url + "/auth/v1/logout?scope=local", {
        method: "POST",
        headers: { apikey: config.key, Authorization: "Bearer " + access },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      revoked = provider.ok;
    } catch {
      revoked = false;
    }
  }
  const response = NextResponse.json({ signedIn: false, serverRevoked: revoked }, {
    headers: noStore,
  });
  clearCookies(response);
  return response;
}
