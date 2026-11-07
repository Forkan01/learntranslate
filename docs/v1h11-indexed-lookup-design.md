# V1-H.11 indexed lookup prototype — review required

This PR introduces an **unapplied prototype**, not a deployable migration. No production DB or app change occurs.

## Architecture
- Derived `card_lookup_terms` stores normalized reverse English translation senses and curated German noun singular/article/plural forms.
- Composite B-tree index enables equality lookups without scanning all published card JSON.
- Row-level security exposes terms only when the corresponding card is published.
- A restricted trigger maintains entries when card content or publication status changes.

## Blockers before migration
1. **SECURITY DEFINER audit:** trigger runs with owner privileges to maintain a derived table, so audit owner and permissions; consider a private schema and non-exposed trigger function instead of `public`.
2. **Normalization parity:** PostgreSQL NFKC/lowercase and JS locale-aware normalization may differ for special whitespace and case mappings. Use a cross-runtime corpus and fail closed on disagreement.
3. **Semantic parity:** existing fallback accepts exact non-noun German term, and noun terms with article embedded in term. Confirm all matching paths and avoid wrong-article matches.
4. **Backfill:** implement non-mutating batch backfill of existing published cards, with transaction rollback and count checks.
5. **Security tests:** verify anonymous queries, draft/review exclusion, direct function EXECUTE denial, and RLS after publish/unpublish.
6. **Performance:** EXPLAIN equality lookups on representative dataset; ensure primary exact-key lookup remains unchanged.
7. **Deploy:** apply audited migration, verify actual RPC and read behavior, then separately switch API with a tested fallback.

Do **not** execute this prototype against production as-is. The SQL has not been applied or run in CI.
