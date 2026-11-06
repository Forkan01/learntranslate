import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const source = readFileSync(new URL("../src/app/api/auth/session/route.ts", import.meta.url), "utf8");
const get = source.slice(source.indexOf("export async function GET("), source.indexOf("export async function DELETE("));
test("ambiguous invalid refresh credentials preserve cookies for recovery", () => {
  assert.match(get, /response\.status === 400 \|\| response\.status === 401 \|\| response\.status === 403/);
  assert.match(get, /error instanceof InvalidRefreshCredentialError/);
  const invalid = get.slice(get.indexOf("if (error instanceof InvalidRefreshCredentialError)"), get.indexOf("// Network failures"));
  assert.match(invalid, /retryable: true/);
  assert.match(invalid, /status: 503/);
  assert.doesNotMatch(invalid, /clearCookies/);
});
test("transient refresh failures preserve cookies and return retryable 503", () => {
  assert.match(get, /if \(!config\) return NextResponse\.json\(\{ signedIn: false, retryable: true \}/);
  const catchBlock = get.slice(get.indexOf("} catch (error) {"));
  assert.match(catchBlock, /status: 503/);
  assert.match(catchBlock, /retryable: true/);
  assert.equal(catchBlock.split("clearCookies(result)").length - 1, 0);
});
test("refresh still uses process-local singleflight and sets cookies only on verified success", () => {
  assert.match(get, /singleFlightRefresh\(refresh, async \(\) =>/);
  assert.match(get, /verifyGenerationUser\(tokens\.access_token\)/);
  assert.match(get, /setCookies\(result, tokens\.access, tokens\.refresh, tokens\.expires\)/);
});
