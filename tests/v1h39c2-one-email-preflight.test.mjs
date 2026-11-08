import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decideMagicLinkEmailSend } from "../src/lib/cards/magic-link-send-preflight.mjs";

const signIn = readFileSync(new URL("../src/app/search/GenerationSignIn.tsx", import.meta.url), "utf8");
const callback = readFileSync(new URL("../src/app/auth/callback/page.tsx", import.meta.url), "utf8");
const sessionRoute = readFileSync(new URL("../src/app/api/auth/session/route.ts", import.meta.url), "utf8");
const gate = readFileSync(new URL("../src/lib/cards/same-origin-write.ts", import.meta.url), "utf8");

test("only an explicit signed-out response may authorize spending one email", () => {
  assert.equal(decideMagicLinkEmailSend(200, { signedIn: false }), "may-send");
  assert.equal(decideMagicLinkEmailSend(200, { signedIn: true }), "already-signed-in");
});

test("missing, invalid, and uncertain sessions never consume an email", () => {
  for (const status of [0, 400, 401, 403, 429, 500, 503]) {
    assert.equal(decideMagicLinkEmailSend(status, { signedIn: false }), "uncertain");
  }
  for (const body of [null, undefined, "false", {}, [], {signedIn:null},
    {signedIn:"false"}, {signedIn:1}, {signedIn:undefined}]) {
    assert.equal(decideMagicLinkEmailSend(200, body), "uncertain");
  }
});

test("UI checks existing HttpOnly browser session before sending OTP email", () => {
  const probe = signIn.indexOf('fetch("/api/auth/session"');
  const decision = signIn.indexOf('decideMagicLinkEmailSend(session.status, payload)');
  const emailRequest = signIn.indexOf('new URL(config.url + "/auth/v1/otp")');
  assert.ok(probe > 0 && decision > probe && emailRequest > decision);
  assert.match(signIn, /if \(decision === "uncertain"\)/);
  assert.match(signIn, /if \(decision === "already-signed-in"\)/);
  assert.match(signIn, /state !== "idle"/);
  assert.match(signIn, /state === "sent"/);
  assert.doesNotMatch(signIn, /localStorage|sessionStorage|SUPABASE_SERVICE_ROLE_KEY/);
});

test("callback verifies server cookies using a fresh no-email request before success", () => {
  const post = callback.indexOf('return fetch("/api/auth/session"');
  const confirm = callback.indexOf('async function confirmBrowserSession()');
  assert.ok(post > confirm && confirm > 0);
  assert.match(callback, /method: "GET", credentials: "same-origin", cache: "no-store"/);
  assert.match(callback, /if \(!confirmed\) \{/);
  assert.match(callback, /setSessionConfirmed\(true\)/);
  assert.match(callback, /sessionConfirmed && <Link href="\/admin"/);
  assert.match(callback, /"signedIn" in proof && proof\.signedIn === true/);
  assert.doesNotMatch(callback, /localStorage|sessionStorage|SUPABASE_SERVICE_ROLE_KEY/);
});

test("callback won't consume another email simply because it is reopened without a fragment", () => {
  assert.match(callback, /if \(redirect\.kind === "missing"\)/);
  assert.match(callback, /const existing = await confirmBrowserSession\(\);/);
  assert.match(callback, /You're already signed in/);
  assert.match(callback, /Check your session at \/api\/auth\/session before requesting another email/);
});

test("server session remains strict-origin with HttpOnly Secure cookies", () => {
  assert.match(sessionRoute, /allowSameOriginWrite\(request\)/);
  assert.match(sessionRoute, /httpOnly: true, secure: true, sameSite: "lax"/);
  assert.match(sessionRoute, /bindSessionTokenPair\(access, refresh, config\)/);
  assert.match(sessionRoute, /response\.cookies\.set\(ACCESS,/);
  assert.match(gate, /NEXT_PUBLIC_APP_URL/);
  assert.match(gate, /"http:" && actual\.hostname === "localhost"/);
});
