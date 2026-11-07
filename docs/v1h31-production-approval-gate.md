# V1-H.31 — Production migration approval gate

**State: HOLD. No production DDL, no feature-flag activation.**

## Live baseline (2026-11-07)
Read-only query confirmed:
- 24 total cards, 24 published.
- 64 indexed terms belonging to 24 cards in the existing private search index.
- `public.cards` RLS enabled.
- `public.lookup_published_card_indexed` is still SECURITY DEFINER (existing live security advisor warning).

## Deployment decision
The H.24/H.25/H.26 SQL is staged in GitHub but not applied to production. The current H.26 proposal grants anon/authenticated SELECT on a public derived-terms table. That makes the vocabulary term list enumerable by anonymous clients. Published cards are intended to be public, but direct term-index exposure must be explicitly accepted or redesigned. Prefer a safer API-only design if direct term enumeration is unnecessary.

## Approval prerequisites
1. Review live `public.cards` policies and grants using `docs/sql/v1h31-production-approval-gate.sql`. Confirm anon/authenticated can read **only** published cards.
2. Confirm existing backup and restore procedure; do not mistake transaction rollback rehearsal for backup verification.
3. Inspect H.28 CI EXPLAIN ANALYZE output and validate realistic query plans.
4. Obtain explicit owner approval for the specific production DDL (H.24, H.25, H.26) **after** the public-term exposure decision.
5. Snapshot baseline counts, run the migration in order, verify count parity, role-scoped RPC behavior, draft isolation, trigger synchronization, and advisors. If any verification fails, leave `CARD_INDEXED_SEARCH_ENABLED=false` and follow the reviewed recovery procedure.
6. Only then consider a separate feature-flag activation and application smoke test.

## Out of scope
No production write or Vercel environment change is authorized by merging this PR. This is an approval gate, not an implicit permission to deploy.
