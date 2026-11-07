# V1-H.10 — integration compatibility gate

**Do not deploy the staged SQL or switch the API yet.**

The current API's exact `search_key` lookup is indexed and remains the primary lookup. Its fallback currently pages published cards, up to 5,000. The staged RPC moves fallback filtering into PostgreSQL, but **it does not yet add an index for the computed translation senses or inflected noun forms**. Calling it an indexed replacement or claiming scalability would be premature.

## Verified (read-only)
- Connected database is PostgreSQL 17 and supports NFKC.
- Existing RLS SELECT policy exposes only published cards to `anon` and `authenticated`; both have SELECT permission and no BYPASSRLS.
- Initial 8 curated reverse-sense/article/plural cases passed in a SQL query equivalent to the staged matching predicates.

## Remaining blocking work
1. Compare a corpus against the **actual** TypeScript `normalizeSearchTerm`, including NFKC decomposed forms, nonbreaking spaces, locale case mapping, and unusual whitespace. SQL `[[:space:]]` does not necessarily match JS `\\s`.
2. Match all existing fallback semantics: existing JS accepts an exact singular term even if non-noun, and a plural only if bare. It also validates content's language/type fields, not merely row metadata.
3. Install and call the RPC in a controlled test environment with `anon` and `authenticated`, verifying unpublished cards cannot leak. Review function EXECUTE grants.
4. Confirm correct behavior for explicit wrong noun articles, multiple senses, and deterministic selection if multiple cards share a sense.
5. Benchmark and plan index-backed lookup at representative scale before retiring bounded pagination.
6. Add integration tests to CI and implement a separate guarded API change with safe fallback.

This PR only tightens staged SQL and records blockers; it makes no live database or API changes.
