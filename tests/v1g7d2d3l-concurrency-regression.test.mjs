import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/cards/distributed-refresh-coordinator.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { coordinateRefresh } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const pair = { access: "access-user-A", refresh: "refresh-user-A", expires: 3600 };
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }

test("two independent callers: exactly one provider rotation and verified handoff reuse", async () => {
  const entered = deferred();
  const continueRefresh = deferred();
  let owner = null, published = null, providerCalls = 0, releaseCalls = 0;
  const deps = () => ({
    acquire: async () => owner ? null : (owner = Symbol("owner")),
    readVerifiedHandoff: async () => published,
    refreshProvider: async () => {
      providerCalls++;
      entered.resolve();
      await continueRefresh.promise;
      return pair;
    },
    publish: async (lease, value) => {
      if (lease !== owner) return false;
      published = value;
      return true;
    },
    release: async () => { releaseCalls++; owner = null; return true; },
    wait: async () => { await continueRefresh.promise; },
  });
  const first = coordinateRefresh(deps());
  await entered.promise;
  const second = coordinateRefresh(deps());
  continueRefresh.resolve();
  const outcomes = await Promise.all([first, second]);
  assert.deepEqual(outcomes, [{ kind: "success", pair }, { kind: "success", pair }]);
  assert.equal(providerCalls, 1);
  assert.equal(releaseCalls, 1);
});

test("lost ownership after provider rotation never returns uncommitted credentials", async () => {
  const deps = {
    acquire: async () => ({ owner: "expired" }),
    readVerifiedHandoff: async () => null,
    refreshProvider: async () => pair,
    publish: async () => false,
    release: async () => false,
    wait: async () => {},
  };
  assert.deepEqual(await coordinateRefresh(deps), { kind: "retryable" });
});

test("concurrent Redis outage preserves retryable result and avoids provider", async () => {
  let providerCalls = 0;
  const deps = () => ({
    acquire: async () => { throw new Error("Redis offline"); },
    readVerifiedHandoff: async () => { throw new Error("Redis offline"); },
    refreshProvider: async () => { providerCalls++; return pair; },
    publish: async () => true,
    release: async () => true,
    wait: async () => {},
  });
  const outcomes = await Promise.all(Array.from({ length: 6 }, () => coordinateRefresh(deps())));
  assert.ok(outcomes.every(o => o.kind === "retryable"));
  assert.equal(providerCalls, 0);
});
