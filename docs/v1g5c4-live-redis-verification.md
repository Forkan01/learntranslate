# V1-G.5C.4 — Live Redis integration (opt-in)

This PR adds an integration test that sends the **actual production Lua** to a live Upstash-compatible Redis REST endpoint. It verifies two users' quota isolation, global minute cap, counter TTL, and 25 concurrent EVAL reservations. All test keys use a random `lt:integration:<UUID>:` namespace. The test is **skipped by default**.

## Run safely

1. Provision a **disposable/scratch Redis database** separate from LearnTranslate production and DOT AI. Never reuse production Redis credentials.
2. In a trusted local terminal or an isolated CI job with secrets, set `LT_REDIS_INTEGRATION=1`, `LT_REDIS_ISOLATED=YES`, `LT_TEST_REDIS_URL`, and `LT_TEST_REDIS_TOKEN`. Do not set these in `NEXT_PUBLIC_*` variables or expose them in chat or logs.
3. Run `node --test tests/v1g5c4-live-redis.test.mjs`. Expect one successful test. Without the opt-in flag the test is skipped.
4. Check Redis usage and remove the disposable database afterward. Keys use short TTLs and a unique prefix.

The test does not generate AI cards, consume production quotas, or modify deployment configuration. GitHub CI only checks the default skip and the existing simulation; **a passing CI run is not evidence that live Redis was tested**.

Limitations: UTC day-boundary expiry, network partitions, and Supabase cookie integration require additional controlled testing. The quota remains a request count, not a monetary spending limit. Public generation stays disabled.
