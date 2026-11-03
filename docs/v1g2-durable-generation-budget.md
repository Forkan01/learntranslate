# V1-G.2 — Durable private generation admission

This change does **not** enable public generation. `ENABLE_CARD_GENERATION` remains false by default and the private admin token gate remains required.

## Admission limits
- Global ceiling: **10 admitted generation attempts per UTC day** and **2 per UTC minute**, across all server instances.
- Redis `EVAL` checks and increments both counters atomically. Rejected requests consume no quota.
- Admitted attempts consume quota even when Gemini fails, conservatively bounding attempted calls.
- Missing Redis configuration, HTTP errors, timeout, or invalid Redis response -> **503 fail closed**.
- Exceeded quota -> **429**. Limits are **global**, not per user.
- No database writes or publication; existing generated responses remain unsaved.

## Required server-only environment variables (for a controlled private trial)
- `ENABLE_CARD_GENERATION=true`
- `CARD_GENERATION_ADMIN_TOKEN` (random 32+ character secret)
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- Provider API credentials already required by the existing adapter.

**Do not set ENABLE_CARD_GENERATION=true in production yet.** The server-side token is private and cannot be shipped in a browser. A global request cap is not a monetary budget; public generation additionally needs per-user quotas, abuse resistance, cache-first deduplication, and a provider spending ceiling.

## Validation
Run `node --test tests/v1g2-generation-budget-contract.test.mjs`, lint, TypeScript, and build. Contract tests inspect source only. Before enabling in a controlled environment, test real Redis responses, concurrent requests, missing credentials, 429 and 503 paths.
