import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const ui = readFileSync(new URL("../src/app/search/GenerationSignIn.tsx", import.meta.url), "utf8");
test("redirect URL uses Supabase Auth OTP query parameter", () => {
  assert.ok(ui.includes('authUrl.searchParams.set("redirect_to", window.location.origin + "/auth/callback")'));
  assert.ok(ui.includes("fetch(authUrl.toString()"));
});
test("request failures show safe status-specific messages", () => {
  assert.ok(ui.includes("response.status === 429"));
  assert.ok(ui.includes("response.status === 400 || response.status === 422"));
  assert.ok(ui.includes("response.status >= 500"));
  assert.ok(!ui.includes("Couldn't send a code"));
});
test("prevents duplicate submissions and does not persist tokens", () => {
  assert.ok(ui.includes('if (state !== "idle") return;'));
  assert.ok(ui.includes('disabled={state === "sending"}'));
  assert.ok(!ui.includes("localStorage"));
  assert.ok(!ui.includes("sessionStorage"));
});
