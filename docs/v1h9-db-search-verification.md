# V1-H.9 — Database-side search verification

## Completed against connected Supabase (read-only)
- Existing RLS policy: `Published cards are readable` for `anon` and `authenticated`.
- Both roles have table SELECT privilege; neither has BYPASSRLS.
- Initial 8 German article/plural/English sense cases passed against existing published cards.
- PostgreSQL NFKC probes: full-width letters, uppercase umlauts, repeated ASCII whitespace, Ä, ẞ, and decomposed diaeresis normalize as expected.

## Issues caught
- The staged SQL allowed noun-form fallback for non-noun cards; this PR restricts singular/article matching to noun cards.
- **Do not activate the RPC yet.** PostgreSQL whitespace classes and lowercasing can differ from JavaScript `String.normalize('NFKC')` and locale-specific case mapping. The deployed route still uses the TypeScript contract.

## Remaining release blockers
1. Run a cross-runtime JS/SQL corpus comparison, including NBSP, narrow NBSP, zero-width and Turkish dotted I.
2. Run actual RPC under `anon` and `authenticated` after installation in a controlled database transaction, including drafts.
3. Benchmark larger data and add appropriate indexed lookup before claiming scale performance.
4. Only then enable RPC in a separate application PR.

This PR makes **no live database or application changes**.
