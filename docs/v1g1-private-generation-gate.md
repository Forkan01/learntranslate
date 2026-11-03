# V1-G.1 — Private AI generation gate

This milestone **does not enable public AI generation**. The existing generation endpoint is disabled unless `ENABLE_CARD_GENERATION=true`. Even if enabled, it now requires a server-only `CARD_GENERATION_ADMIN_TOKEN` of at least 32 characters, sent in an Authorization Bearer header. Requests with an Origin header are rejected as a defense-in-depth browser check (not an authentication mechanism).

## Production posture

- Leave `ENABLE_CARD_GENERATION` unset/false in public deployments.
- Do **not** set `CARD_GENERATION_ADMIN_TOKEN` in any `NEXT_PUBLIC_*` variable, browser, mobile app, or public repository.
- Token is intended only for private server-to-server trials. The endpoint still returns an unsaved card and does not publish anything.
- This is **not** a substitute for rate limits or quotas. A compromised token could still incur provider costs. Do not enable in production until durable per-identity quotas, abuse controls, budget ceilings, request deduplication, and monitoring are implemented.
- A later milestone will add a safe public generation workflow and explicit review-first persistence.
- Existing public database search remains read-only and unaffected.

## Verification

Run `node --test tests/v1g1-private-generation-gate.test.mjs`, lint, TypeScript check, and build. The source contract tests are not runtime security tests; follow with negative HTTP tests in a controlled preview before any enablement.
