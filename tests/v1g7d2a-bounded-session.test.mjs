import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/cards/bounded-json.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { readBoundedJson } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
test("session-sized JSON accepted and oversized request rejected", async () => {
  const good = new Request("https://example.test/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_token: "a".repeat(4000), refresh_token: "b".repeat(4000), expires_in: 3600 }) });
  assert.equal((await readBoundedJson(good, 16384)).expires_in, 3600);
  const huge = new Request("https://example.test/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: "x".repeat(17000) }) });
  await assert.rejects(readBoundedJson(huge, 16384), /Body too large/);
});
test("session creation checks same-origin and JSON type before bounded read and verification", () => {
  const route = readFileSync(new URL("../src/app/api/auth/session/route.ts", import.meta.url), "utf8");
  const post = route.slice(route.indexOf("export async function POST("), route.indexOf("export async function GET("));
  assert.ok(post.includes("readBoundedJson(request, 16384)"));
  assert.ok(post.indexOf("allowSameOriginWrite(request)") < post.indexOf("readBoundedJson(request, 16384)"));
  assert.ok(post.indexOf("readBoundedJson(request, 16384)") < post.indexOf("bindSessionTokenPair(access, refresh, config)"));
  assert.ok(!post.includes("await request.json()"));
});
