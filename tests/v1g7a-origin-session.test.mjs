import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/cards/same-origin-write.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { allowSameOriginWrite } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const previous = process.env.NEXT_PUBLIC_APP_URL;
function req(origin, site) {
  const headers = new Headers();
  if (origin !== null) headers.set("origin", origin);
  if (site !== null) headers.set("sec-fetch-site", site);
  return new Request("https://learntranslate.vercel.app/api/auth/session", { method: "POST", headers });
}
test("same-origin write gate rejects absent, foreign and misleading origins", () => {
  process.env.NEXT_PUBLIC_APP_URL = "https://learntranslate.vercel.app";
  try {
    assert.equal(allowSameOriginWrite(req("https://learntranslate.vercel.app", "same-origin")), true);
    assert.equal(allowSameOriginWrite(req(null, null)), false);
    assert.equal(allowSameOriginWrite(req("https://evil.example", "same-origin")), false);
    assert.equal(allowSameOriginWrite(req("https://learntranslate.vercel.app.evil.example", null)), false);
    assert.equal(allowSameOriginWrite(req("http://learntranslate.vercel.app", null)), false);
    assert.equal(allowSameOriginWrite(req("https://learntranslate.vercel.app", "cross-site")), false);
    assert.equal(allowSameOriginWrite(req("https://learntranslate.vercel.app", "same-site")), false);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous;
  }
});
test("session writes and quota probe share strict gate; session POST requires JSON", () => {
  const session = readFileSync(new URL("../src/app/api/auth/session/route.ts", import.meta.url), "utf8");
  const probe = readFileSync(new URL("../src/app/api/cards/quota-probe/route.ts", import.meta.url), "utf8");
  assert.ok(session.includes("!allowSameOriginWrite(request)"));
  assert.ok(probe.includes("!allowSameOriginWrite(request)"));
  assert.ok(session.includes('!== "application/json"'));
  assert.ok(probe.includes('process.env.ENABLE_VERIFIED_QUOTA_PROBE !== "true"'));
});
