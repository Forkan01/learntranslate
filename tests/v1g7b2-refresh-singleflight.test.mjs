import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/cards/refresh-singleflight.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { singleFlightRefresh } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
test("simultaneous same-token refreshes share one operation", async () => {
  let calls = 0;
  const results = await Promise.all(Array.from({ length: 30 }, () => singleFlightRefresh("refresh-a", async () => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 20));
    return { access: "new-token" };
  })));
  assert.equal(calls, 1);
  assert.ok(results.every(x => x.access === "new-token"));
});
test("different tokens remain independent", async () => {
  let calls = 0;
  await Promise.all(["one", "two"].map(token => singleFlightRefresh(token, async () => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 10));
  })));
  assert.equal(calls, 2);
});
test("failed operations are removed so retries can proceed", async () => {
  await assert.rejects(singleFlightRefresh("retry-token", async () => { throw new Error("failed"); }));
  assert.equal(await singleFlightRefresh("retry-token", async () => "recovered"), "recovered");
});
test("session route uses singleflight without enabling public generation", () => {
  const route = readFileSync(new URL("../src/app/api/auth/session/route.ts", import.meta.url), "utf8");
  assert.ok(route.includes("singleFlightRefresh(refresh, async () =>"));
  assert.ok(route.includes("setCookies(result, tokens.access, tokens.refresh, tokens.expires)"));
});
