import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const route = readFileSync(new URL("../src/app/api/auth/session/route.ts", import.meta.url), "utf8");
const sameOrigin = readFileSync(new URL("../src/lib/cards/same-origin-write.ts", import.meta.url), "utf8");
const callback = readFileSync(new URL("../src/app/auth/callback/page.tsx", import.meta.url), "utf8");
const ui = readFileSync(new URL("../src/app/search/page.tsx", import.meta.url), "utf8");

test("session cookies are HttpOnly secure and SameSite", () => {
  for (const part of ['httpOnly: true', 'secure: true', 'sameSite: "lax"', 'maxAge: 60 * 60 * 24 * 7']) assert.ok(route.includes(part));
});

test("session establishment binds credentials and uses shared origin gate", () => {
  assert.ok(route.includes("if (!allowSameOriginWrite(request))"));
  assert.ok(sameOrigin.includes('request.headers.get("origin")'));
  assert.ok(sameOrigin.includes('allowed.has(actual.origin)'));
  assert.ok(route.includes("await bindSessionTokenPair(access, refresh, config)"));
  assert.ok(route.includes("setCookies(response, bound.access, bound.refresh, bound.expires)"));
  assert.ok(route.includes("await verifyGenerationUser(access)"));
  assert.ok(route.includes('"/auth/v1/token?grant_type=refresh_token"'));
  assert.ok(route.includes("clearCookies(response)"));
});

test("callback exchanges fragment credentials without local persistence", () => {
  assert.ok(callback.includes('window.history.replaceState(null, "", "/auth/callback")'));
  assert.ok(callback.includes('fetch("/api/auth/session"'));
  assert.ok(!callback.includes("localStorage"));
  assert.ok(ui.includes("<SessionStatus />"));
});
