# V1-C.4 — Server-only review storage foundation

This milestone adds `queueGeneratedCardForReview(card)`, a server-only function, not a public endpoint. It revalidates generated content, derives a normalized search key, and inserts it with `status: "review"` using conflict-ignore semantics. No update of existing published cards occurs.

## Safety gates
- Disabled unless `ENABLE_CARD_REVIEW_STORAGE=true`.
- Uses `SUPABASE_SERVICE_ROLE_KEY` only on the server. **Never** use a `NEXT_PUBLIC_` prefix for this credential.
- Do not enable in production or connect this to a public unauthenticated endpoint until rate limiting, quotas, and authenticated authorization are implemented.
- This module has no caller yet; no live Supabase cards are changed by this PR.
- The returned `stored: true` means the insert request succeeded, not necessarily that a new row was inserted (duplicates are ignored).

## Next steps
Add runtime tests with a mocked database, audit validation completeness and content quality, then connect an authenticated and rate-limited generation flow. Published cards must remain editorially approved.
