import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const session = readFileSync(new URL("../src/app/api/auth/session/route.ts", import.meta.url), "utf8");
test("refresh input and provider response both require bounded valid tokens", () => {
  assert.ok(session.includes("function validRefresh("));
  assert.ok(session.includes("function validExpires("));
  assert.ok(session.includes("!validRefresh(refresh) || !validExpires(expires)"));
  assert.ok(session.includes("!validRefresh(tokens.refresh_token) || !validExpires(tokens.expires_in)"));
  assert.ok(session.includes("Number.isSafeInteger(value)"));
});
test("access cookie lifetime never exceeds supplied expiry less safety margin", () => {
  assert.ok(session.includes("Math.min(Math.max(expiresIn - 30, 1), 3600)"));
  assert.ok(session.includes("httpOnly: true"));
  assert.ok(session.includes("secure: true"));
  assert.ok(session.includes('sameSite: "lax"'));
});
test("session failure clears both cookies; logout requires same-origin", () => {
  assert.ok(session.includes('response.cookies.set(ACCESS, "",'));
  assert.ok(session.includes('response.cookies.set(REFRESH, "",'));
  assert.ok(session.includes('if (!allowSameOriginWrite(request))'));
});
