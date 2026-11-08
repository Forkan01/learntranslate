import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validEmailOtp, validOtpEmail, parseEmailOtpSession,
} from "../src/lib/cards/email-otp-credentials.mjs";

const page = readFileSync(new URL("../src/app/auth/sign-in/page.tsx", import.meta.url), "utf8");
const admin = readFileSync(new URL("../src/app/admin/page.tsx", import.meta.url), "utf8");
const callback = readFileSync(new URL("../src/app/auth/callback/page.tsx", import.meta.url), "utf8");
const search = readFileSync(new URL("../src/app/search/GenerationSignIn.tsx", import.meta.url), "utf8");

const pair = {
  access_token: "eyJhbGciOiJ.test.signature",
  refresh_token: "refresh_token12345",
  expires_in: 3600,
};

test("only six-digit numeric one-time codes are accepted", () => {
  assert.equal(validEmailOtp("012345"), true);
  assert.equal(validEmailOtp("123456"), true);
  for (const bad of ["", "12345", "1234567", "abcdef", "123 456", "123\n456", 123456, null]) {
    assert.equal(validEmailOtp(bad), false);
  }
});

test("email input validation rejects malformed or excessive values", () => {
  assert.equal(validOtpEmail("account@example.com"), true);
  for (const bad of ["", "abc", "a@b", "a@b.", " a@b.com", "a@b.com ", "a\nb@example.com", "a".repeat(250) + "@b.co", null]) {
    assert.equal(validOtpEmail(bad), false);
  }
});

test("Supabase OTP session credentials are accepted only with bounded valid shapes", () => {
  assert.deepEqual(parseEmailOtpSession(pair), pair);
  for (const bad of [
    null, {}, [], { ...pair, access_token: "" },
    { ...pair, access_token: "a".repeat(8193) },
    { ...pair, access_token: "a b" },
    { ...pair, refresh_token: "short" },
    { ...pair, refresh_token: "" },
    { ...pair, expires_in: 0 }, { ...pair, expires_in: 100000 },
    { ...pair, expires_in: "3600" }, { ...pair, expires_in: 61.2 },
  ]) assert.equal(parseEmailOtpSession(bad), null);
});

test("code login requests OTP for an existing account only", () => {
  assert.match(page, /"\/auth\/v1\/otp"/);
  assert.match(page, /create_user: false/);
  assert.match(page, /method: "POST"/);
  assert.match(page, /validOtpEmail\(email\.trim\(\)\)/);
  assert.match(page, /Send six-digit code/);
  assert.doesNotMatch(page, /create_user: true/);
});

test("code verification is typed 'email', validates digits, and exchanges no URL fragments", () => {
  assert.match(page, /"\/auth\/v1\/verify"/);
  assert.match(page, /token: otp, type: "email"/);
  assert.match(page, /validEmailOtp\(otp\)/);
  assert.match(page, /parseEmailOtpSession\(responseBody\)/);
  assert.doesNotMatch(page, /window\.location\.hash|ConfirmationURL|window\.location\.search/);
  assert.doesNotMatch(page, /localStorage|sessionStorage/);
});

test("credentials are passed to existing protected HttpOnly session route in serialized order", () => {
  assert.match(page, /serializeSessionRequest/);
  assert.match(page, /callbackIsStale\(marker\)/);
  assert.match(page, /fetch\("\/api\/auth\/session"/);
  assert.match(page, /credentials: "same-origin"/);
  assert.match(page, /body: JSON\.stringify\(tokens\)/);
  assert.match(page, /"signedIn" in payload && payload\.signedIn === true/);
  assert.match(page, /phase === "complete"/);
  assert.doesNotMatch(page, /NEXT_PUBLIC.*SERVICE_ROLE|SUPABASE_SERVICE_ROLE_KEY/);
});

test("admin and failed magic-link pages provide a direct route to email-code sign-in", () => {
  assert.match(admin, /href=\{state === "sign-in" \? "\/auth\/sign-in"/);
  assert.match(callback, /href="\/auth\/sign-in"/);
  assert.match(search, /href="\/auth\/sign-in"/);
});

test("email-code flow does not enable AI generation or admin access by itself", () => {
  assert.doesNotMatch(page, /api\/cards\/generate|api\/admin\/cards|api\/admin\/publish/);
  assert.match(page, /Open Admin Dashboard/);
  assert.match(page, /"\/api\/auth\/session"/);
  assert.doesNotMatch(page, /service_role|grantAdminRole|is_admin/);
});
