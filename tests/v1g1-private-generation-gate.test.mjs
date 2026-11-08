import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../src/app/api/cards/generate/route.ts", import.meta.url), "utf8");

test("generation remains disabled unless explicitly enabled", () => {
  assert.ok(route.includes('process.env.ENABLE_CARD_GENERATION !== "true"'));
});

test("generation requires a private token before bounded parsing, admission, or provider use", () => {
  const gate = route.indexOf("const expected = process.env.CARD_GENERATION_ADMIN_TOKEN;");
  const parse = route.indexOf("await readBoundedJson(request)");
  const admission = route.indexOf("await reserveGenerationAttempt(actorId)");
  const spending = route.indexOf("await reserveEstimatedGenerationCost()");
  const provider = route.indexOf("const card = await generateLearningCard(");
  assert.ok(gate > 0 && gate < parse && parse < admission && admission < spending && spending < provider);
  assert.ok(route.includes('expected.length < 32'));
  assert.ok(route.includes('authorization !== "Bearer " + expected'));
  assert.ok(route.includes('status: 401'));
  assert.ok(route.includes('status: 429'));
  assert.ok(route.includes('admission !== "allowed"'));
  assert.ok(route.includes('spending !== "allowed"'));
});

test("browser-origin generation is rejected", () => {
  assert.ok(route.includes('request.headers.has("origin")'));
  assert.ok(route.includes('status: 403'));
});

test("route does not expose a secret or publish a generated card", () => {
  assert.ok(!route.includes("NEXT_PUBLIC_CARD_GENERATION_ADMIN_TOKEN"));
  assert.ok(route.includes('saved: false, status: "unsaved"'));
});
