import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { captureMagicLinkRedirect } from "../src/lib/cards/magic-link-callback.mjs";

const page = readFileSync(new URL("../src/app/auth/callback/page.tsx", import.meta.url), "utf8");
const sample = "#access_token=eyJh.test.sig&refresh_token=refresh_12345678&expires_in=3600&token_type=bearer";

test("captures valid one-use Supabase implicit-flow credentials in memory", () => {
  assert.deepEqual(captureMagicLinkRedirect(sample), {
    kind: "credentials", accessToken: "eyJh.test.sig",
    refreshToken: "refresh_12345678", expires: 3600,
  });
});

test("StrictMode second effect setup reuses captured values after URL fragment is scrubbed", () => {
  // First effect setup extracts the fragment and clears the browser address.
  const firstSetup = captureMagicLinkRedirect(sample);
  // StrictMode cleanup/setup causes the next call to see an empty URL.
  const secondSetup = captureMagicLinkRedirect("", firstSetup);
  assert.equal(secondSetup, firstSetup);
  assert.equal(secondSetup.kind, "credentials");
  assert.equal(secondSetup.accessToken, "eyJh.test.sig");
  // The first sign-in attempt must be cancelled; a new setup may safely
  // continue using the same in-memory credentials.
  assert.match(page, /if \(cancelled\) return;/);
  assert.match(page, /callbackIsStale\(initialSignOutMarker\)/);
});

test("invalid, expired, missing or anomalous redirect fragments fail closed", () => {
  for (const fragment of [
    "", "#", "#foo=bar", "#access_token=a&refresh_token=r",
    "#access_token=a&refresh_token=r&expires_in=0",
    "#access_token=a&refresh_token=r&expires_in=1",
    "#access_token=a&refresh_token=r&expires_in=999999",
    "#access_token=a&refresh_token=r&expires_in=abc",
    "#" + "x".repeat(20001),
  ]) assert.deepEqual(captureMagicLinkRedirect(fragment), { kind: "missing" }, fragment.slice(0, 80));
});

test("explicit Supabase error fragments report error rather than claiming missing credentials", () => {
  assert.deepEqual(captureMagicLinkRedirect("#error=access_denied&error_description=Expired"), { kind: "error" });
  assert.deepEqual(captureMagicLinkRedirect("#error_description=expired"), { kind: "error" });
});

test("single-use tokens are never persisted and URL is immediately scrubbed", () => {
  assert.match(page, /useRef<ReturnType<typeof captureMagicLinkRedirect>/);
  const captureIndex = page.indexOf("captureMagicLinkRedirect(window.location.hash, captured.current)");
  const stripIndex = page.indexOf('window.history.replaceState(null, "", "/auth/callback")');
  const fetchIndex = page.indexOf('fetch(url.origin + "/auth/v1/user"');
  assert.ok(captureIndex > 0 && stripIndex > captureIndex && fetchIndex > stripIndex);
  assert.doesNotMatch(page, /localStorage|sessionStorage|console\.log\(/);
  assert.match(page, /captured\.current = null/);
});

test("still uses Supabase Auth verification and existing HttpOnly session route", () => {
  assert.match(page, /fetch\(url.origin \+ "\/auth\/v1\/user"/);
  assert.match(page, /serializeSessionRequest/);
  assert.match(page, /fetch\("\/api\/auth\/session"/);
  assert.match(page, /callbackIsStale/);
  assert.doesNotMatch(page, /SUPABASE_SERVICE_ROLE_KEY|create_user: true/);
});
