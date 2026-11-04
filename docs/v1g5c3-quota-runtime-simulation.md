# V1-G.5C.3 — Quota runtime simulation

This milestone executes the **actual TypeScript quota reservation module** using Node 22 and TypeScript transpilation, with a deterministic simulated Upstash REST EVAL response. The CI workflow now runs this test.

Coverage:
- Different verified actors have separate per-minute counters.
- Actors share the global 2/minute ceiling.
- A burst of 25 concurrent callers admits only 2 in the simulated atomic Redis execution.
- Invalid actors, missing Redis credentials, network failures, HTTP 503 and unexpected Redis payloads fail closed.

**Critical distinction:** The simulator interprets the limits from the outgoing EVAL command but does **not execute the Lua script in a real Redis server**. It cannot prove actual Upstash compatibility, Lua correctness, production concurrency, per-day reset, TTL expiry, or end-to-end authenticated cookie behavior. A separate controlled live Redis integration test is required before enabling public generation.

No production env vars are changed, no live Redis calls occur, no Gemini calls occur, and the quota probe stays disabled. The current global ceilings (10/day, 2/minute) and actor ceilings (3/day, 1/minute) are intentionally unchanged.

Suggested live test (later, with an isolated scratch Redis database): execute the EVAL command under concurrency, inspect 4 counters/TTL, validate day and minute boundaries, then tear down keys. Do not run live quota tests against production counters.
