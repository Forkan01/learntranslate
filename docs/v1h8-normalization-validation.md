# V1-H.8 — normalization compatibility gate

This PR updates **staged SQL only**. No production database changes, app routing changes, or Vercel deployment.

PostgreSQL 17 supports `normalize(value, NFKC)`. The helper applies NFKC, whitespace collapsing, trim, and lowercase to both search input and stored card content. A read-only probe verified NFKC full-width normalization and umlaut lowercasing in the connected database.

**Not yet equivalent to the TypeScript normalization contract in every Unicode case:** JavaScript uses locale-specific lowercase (`de-DE`/`en-US`), while PostgreSQL `lower` depends on database collation. The SQL also still needs a reviewed solution for supplied articles and multiword plural edge cases, and exact runtime comparisons before activation.

## Release gate
1. Run SQL in a transaction and test as `anon` and `authenticated` with RLS.
2. Compare TS vs SQL across NFKC compatibility forms, decomposed accents, ß, dotted İ, nonbreaking whitespace, German articles, and plural edge cases.
3. Verify no private/draft cards are returned, and profile search query plans on a representative larger dataset.
4. Only then add a separately reviewed application integration PR.
