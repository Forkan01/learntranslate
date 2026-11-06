import { createHmac, timingSafeEqual } from "node:crypto";
import { refreshIdentity } from "./refresh-handoff-crypto";

const DOMAIN = "lt:auth:identity:v1";
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function signingKey(): Buffer | null {
  const value = process.env.SESSION_IDENTITY_BINDING_KEY;
  return value && /^[0-9a-f]{64}$/i.test(value) ? Buffer.from(value, "hex") : null;
}
function signature(key: Buffer, body: string): Buffer {
  return createHmac("sha256", key).update(DOMAIN).update(".").update(body).digest();
}
/**
 * Only issue after Supabase has independently verified the user AND
 * established that the refresh credential belongs to that same user.
 * The signed claim binds the current rotated refresh token to that user.
 */
export function issueSessionIdentityBinding(userId: string, refreshToken: string, nowSeconds = Math.floor(Date.now() / 1000)): string | null {
  const key = signingKey();
  const id = refreshIdentity(refreshToken);
  if (!key || !id || !UUID.test(userId) || !Number.isSafeInteger(nowSeconds) || nowSeconds < 1) return null;
  const payload = JSON.stringify({ v: 1, u: userId, r: id, i: nowSeconds });
  const body = Buffer.from(payload).toString("base64url");
  return body + "." + signature(key, body).toString("base64url");
}
export function verifySessionIdentityBinding(binding: string, refreshToken: string, nowSeconds = Math.floor(Date.now() / 1000)): string | null {
  const key = signingKey();
  const id = refreshIdentity(refreshToken);
  if (!key || !id || typeof binding !== "string" || binding.length > 1024 || !Number.isSafeInteger(nowSeconds)) return null;
  const parts = binding.split(".");
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return null;
  const actual = Buffer.from(parts[1], "base64url");
  const expected = signature(key, parts[0]);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const decoded: unknown = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return null;
    const claim = decoded as Record<string, unknown>;
    if (claim.v !== 1 || typeof claim.u !== "string" || !UUID.test(claim.u) ||
        claim.r !== id || typeof claim.i !== "number" || !Number.isSafeInteger(claim.i) ||
        claim.i > nowSeconds || nowSeconds - claim.i > MAX_AGE_SECONDS) return null;
    return claim.u;
  } catch { return null; }
}
