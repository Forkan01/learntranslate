# V1-G.7D.1 — Pre-launch security audit (2026-11-04)

**Decision: NOT READY for public AI generation.** This is a code-level review, not a penetration test or live integration result. Keep `ENABLE_CARD_GENERATION` and `ENABLE_VERIFIED_QUOTA_PROBE` disabled in production.

## Confirmed code-level safeguards

- Private generation endpoint requires a server-only admin token and rejects browser Origin headers.
- The private route checks durable global/actor quotas and an estimated-cost reservation before invoking the AI provider. These are *separate Redis operations*, not one transaction.
- The opt-in quota probe verifies the Supabase user server-side and hashes its UUID before per-account admission.
- Redis requests reject missing credentials, invalid endpoints, unexpected responses and transport failures.
- Private generation accepts at most 4 KiB of JSON body data.

## Blocking findings before a public launch

1. **No public generation authorization path exists.** The private admin token and `x-lt-private-actor` are not user authentication. A new public route must require a verified Supabase session and derive actor identity server-side.
2. **No dedicated LearnTranslate Redis is provisioned or live-tested.** Existing simulated Redis tests cannot demonstrate actual atomic behavior, TTLs, or production connectivity. Do not use the DOT AI Redis database.
3. **Budget reservations are estimates, not actual Gemini billing.** A provider-side spend cap/alerts and measured usage reconciliation are required before enabling public access. The quota and cost scripts are separate and can consume one allowance even if the next gate denies.
4. **Session POST accepts a verified access token and a syntactically valid refresh token without proving they belong to the same session.** Resolve this binding risk before relying on cookie refresh for sensitive actions.
5. **Refresh deduplication is process-local only.** Cross-instance refresh races and stale Set-Cookie responses remain possible. Failure to refresh currently clears cookies even for transient provider outages.
6. **Logout is best effort.** `serverRevoked: false` indicates revocation was not confirmed. Clearing browser cookies does not immediately invalidate all issued access JWTs.
7. **Bot defenses are incomplete.** Per-account probe burst control is not IP-level or device-level abuse detection. CAPTCHA/challenge decisions, account-creation abuse controls, and safe rate-limit strategy remain open.
8. **Session POST body is unbounded.** Add a bounded JSON parser before production exposure; do not rely only on the private generation endpoint's body ceiling.

## Release verification checklist

- [ ] Fix session token pairing and bound session POST payloads; add behavioral tests.
- [ ] Design a separate verified-user public generation endpoint with fail-closed admission.
- [ ] Review concurrent quota + cost reservation semantics and refund policy.
- [ ] Create a dedicated LearnTranslate Upstash database; add credentials only to server-side Vercel settings.
- [ ] Run real Redis integration tests against the dedicated database, including parallel requests, TTL, outage, invalid response, and spending ceilings.
- [ ] Verify Supabase login, refresh, logout and multi-instance behavior in a staging deployment.
- [ ] Set provider-side billing safeguards and verify cost assumptions with measured usage.
- [ ] Conduct abuse testing and confirm public generation remains off until sign-off.

## Evidence boundaries

CI checks lint, TypeScript, build and automated tests; CI success alone does not prove production security. This audit intentionally changes no runtime feature flags, production credentials, or Redis data.
