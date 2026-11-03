# V1-G.4 — Private actor quotas (not public user authentication)

This increment preserves the **disabled-by-default** generation endpoint and its private admin Bearer token. It adds a required `x-lt-private-actor` label (8–80 ASCII letters/digits/underscore/hyphen) supplied **only by a trusted private server-side caller** after admin authorization.

An atomic Redis Lua script now reserves all four counters together:
- Global: 10 attempts per UTC day, 2 per minute.
- Private actor: 3 attempts per UTC day, 1 per minute.

All limits are enforced before calling Gemini. Failed provider calls still count. Missing actor, invalid actor or unavailable Redis fail closed. No new database table, no browser endpoint, no user-facing generation, no publication.

**Security boundary:** the private actor header is an *accounting label*, not a verified user identity. A caller possessing the private admin token can choose another label, so this is **not sufficient for public per-user quotas**. Before public rollout, authenticate users with verified server-side sessions, derive stable user IDs from verified claims (never arbitrary headers), add anti-abuse controls and provider monetary spending safeguards. Do not expose the admin token to browsers. Keep `ENABLE_CARD_GENERATION` disabled in public production.

Verify GitHub CI and run `node --test tests/v1g4-private-actor-quota.test.mjs`. Source contract tests alone do not establish runtime concurrency behavior; a controlled Redis integration test is still needed.
