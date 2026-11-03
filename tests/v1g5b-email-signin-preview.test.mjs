import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const ui = readFileSync(new URL("../src/app/search/page.tsx", import.meta.url), "utf8");
const signIn = readFileSync(new URL("../src/app/search/GenerationSignIn.tsx", import.meta.url), "utf8");
const generation = readFileSync(new URL("../src/app/api/cards/generate/route.ts", import.meta.url), "utf8");
test("sign-in preview is optional and appears only with missing cards", () => {
  assert.ok(ui.includes("showSignIn && <GenerationSignIn />"));
  assert.ok(ui.includes("Sign in (preview)"));
});
test("email OTP uses publishable key, no server secret and no token persistence", () => {
  assert.ok(signIn.includes('"/auth/v1/otp"'));
  assert.ok(signIn.includes('"/auth/v1/verify"'));
  assert.ok(signIn.includes('type: "email"'));
  assert.ok(!signIn.includes("localStorage"));
  assert.ok(!signIn.includes("sessionStorage"));
  assert.ok(!signIn.includes("SERVICE_ROLE"));
});
test("public AI generation remains disabled", () => {
  assert.ok(ui.includes('disabled aria-disabled="true"'));
  assert.ok(generation.includes('process.env.ENABLE_CARD_GENERATION !== "true"'));
});
