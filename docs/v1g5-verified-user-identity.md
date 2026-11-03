# V1-G.5A — Verified user identity foundation

This PR adds a **server-only helper** that validates a Supabase access token by calling the project's `/auth/v1/user` endpoint, rejects malformed or anonymous identities, and returns only the verified UUID. This helper is not yet connected to a public generation route.

- Never trust a user ID from request JSON, a custom header, or unverified JWT decoding.
- On verification errors, return no identity; fail closed.
- Existing `/api/cards/generate` remains private and disabled by default.
- Database searches remain anonymous and free; existing local saved cards are unchanged.
- No login UI, user registration flow, public generation, or environment changes are included.

**Before public launch:** integrate a real sign-in flow, connect verified identity to Redis actor quotas (derive the actor key from the verified UUID), add abuse prevention, validate actual Redis concurrency and token-verification failure paths, add provider cost controls, and ensure review-only persistence. The current private actor header must not be used for public quota identity.

Run CI and `node --test tests/v1g5-verified-user-foundation.test.mjs`. Source contract tests do not replace integration tests.
