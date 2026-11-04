import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/cards/same-origin-write.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source.replace("export function", "function") + "\nexport { allowSameOriginWrite };", { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { allowSameOriginWrite } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const previous = { VERCEL_ENV: process.env.VERCEL_ENV, VERCEL_URL: process.env.VERCEL_URL, NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL };
function check(origin, site = "same-origin") {
  return allowSameOriginWrite(new Request("https://preview.example.test/api/auth/session", { headers: { origin, "sec-fetch-site": site } }));
}
test("preview only accepts the exact deployment origin", () => {
  process.env.VERCEL_ENV = "preview";
  process.env.VERCEL_URL = "learntranslate-git-feature-v1g7d2b-session-token-pair-fork-bit.vercel.app";
  process.env.NEXT_PUBLIC_APP_URL = "https://learntranslate.vercel.app";
  assert.equal(check("https://" + process.env.VERCEL_URL), true);
  assert.equal(check("https://learntranslate.vercel.app"), false);
  assert.equal(check("https://evil.example"), false);
  assert.equal(check("https://" + process.env.VERCEL_URL, "cross-site"), false);
});
test("production still accepts only configured production origin", () => {
  process.env.VERCEL_ENV = "production";
  assert.equal(check("https://learntranslate.vercel.app"), true);
  assert.equal(check("https://learntranslate-git-feature-v1g7d2b-session-token-pair-fork-bit.vercel.app"), false);
});
test("callback distinguishes session rejection from expired credentials", () => {
  const callback = readFileSync(new URL("../src/app/auth/callback/page.tsx", import.meta.url), "utf8");
  assert.ok(callback.includes("session.status === 403"));
  assert.ok(callback.includes("session.status === 401"));
});
process.env.VERCEL_ENV = previous.VERCEL_ENV;
process.env.VERCEL_URL = previous.VERCEL_URL;
process.env.NEXT_PUBLIC_APP_URL = previous.NEXT_PUBLIC_APP_URL;
