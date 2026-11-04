import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/cards/bounded-json.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { readBoundedJson } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const req = (body, type = "application/json") => new Request("https://example.test/", { method: "POST", headers: { "Content-Type": type }, body });
test("accepts small JSON", async () => {
  assert.deepEqual(await readBoundedJson(req('{"term":"Haus"}')), { term: "Haus" });
});
test("rejects oversized content-length, chunked streams and wrong type", async () => {
  await assert.rejects(readBoundedJson(req("x".repeat(4097))), /Body too large/);
  await assert.rejects(readBoundedJson(req('{"ok":true}', "text/plain")), /Unsupported content type/);
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(3000)); controller.enqueue(new Uint8Array(2000)); controller.close(); } });
  const streamed = new Request("https://example.test/", { method: "POST", headers: { "Content-Type": "application/json" }, body: stream, duplex: "half" });
  await assert.rejects(readBoundedJson(streamed), /Body too large/);
});
test("private generation route bounds body before admission and provider calls", () => {
  const route = readFileSync(new URL("../src/app/api/cards/generate/route.ts", import.meta.url), "utf8");
  assert.ok(route.indexOf("readBoundedJson(request)") < route.indexOf("reserveGenerationAttempt(actorId)"));
  assert.ok(route.indexOf("readBoundedJson(request)") < route.indexOf("generateLearningCard({"));
  assert.ok(route.includes('process.env.ENABLE_CARD_GENERATION !== "true"'));
});
