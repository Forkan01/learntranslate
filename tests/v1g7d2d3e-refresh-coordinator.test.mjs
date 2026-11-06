import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/cards/distributed-refresh-coordinator.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { coordinateRefresh } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const pair = { access: "verified-access", refresh: "rotated-refresh", expires: 3600 };
function harness(overrides = {}) {
  const events = [];
  const deps = {
    acquire: async () => { events.push("acquire"); return { owner: "one" }; },
    readVerifiedHandoff: async () => null,
    refreshProvider: async () => { events.push("refresh"); return pair; },
    publish: async () => { events.push("publish"); return true; },
    release: async () => { events.push("release"); return true; },
    wait: async () => {},
    ...overrides,
  };
  return { deps, events };
}
test("owner publishes verified pair and releases lease", async () => {
  const h = harness();
  assert.deepEqual(await coordinateRefresh(h.deps), { kind: "success", pair });
  assert.deepEqual(h.events, ["acquire", "refresh", "publish", "release"]);
});
test("contender never calls provider; adopts verified handoff", async () => {
  let reads = 0;
  const h = harness({ acquire: async () => null, readVerifiedHandoff: async () => ++reads === 2 ? pair : null });
  assert.deepEqual(await coordinateRefresh(h.deps), { kind: "success", pair });
  assert.deepEqual(h.events, []);
});
test("contention timeout returns retryable without provider refresh", async () => {
  const h = harness({ acquire: async () => null });
  assert.deepEqual(await coordinateRefresh(h.deps), { kind: "retryable" });
  assert.deepEqual(h.events, []);
});
test("provider rejection and lost lease return retryable", async () => {
  const bad = harness({ refreshProvider: async () => { throw new Error("invalid token or outage"); } });
  assert.deepEqual(await coordinateRefresh(bad.deps), { kind: "retryable" });
  assert.deepEqual(bad.events, ["acquire", "release"]);
  const lost = harness({ publish: async () => false });
  assert.deepEqual(await coordinateRefresh(lost.deps), { kind: "retryable" });
  assert.ok(lost.events.includes("release"));
});
test("Redis failure and malformed handoff fail closed", async () => {
  const failed = harness({ acquire: async () => { throw new Error("Redis down"); } });
  assert.deepEqual(await coordinateRefresh(failed.deps), { kind: "retryable" });
  const badHandoff = harness({ readVerifiedHandoff: async () => { throw new Error("tampered"); } });
  assert.deepEqual(await coordinateRefresh(badHandoff.deps), { kind: "retryable" });
});
test("handoff appearing after lease acquisition avoids redundant refresh", async () => {
  let reads = 0;
  const h = harness({ readVerifiedHandoff: async () => ++reads === 2 ? pair : null });
  assert.deepEqual(await coordinateRefresh(h.deps), { kind: "success", pair });
  assert.deepEqual(h.events, ["acquire", "release"]);
});
