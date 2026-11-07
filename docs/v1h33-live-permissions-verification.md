# V1-H.33 — Verified live permission boundary

Read-only live checks on 2026-11-07:

| Check | Live result |
|---|---|
| `public.cards` SELECT RLS policy | `Published cards are readable`, roles `anon,authenticated`, `status = 'published'` |
| anon SELECT on cards | yes, filtered by RLS |
| authenticated SELECT on cards | yes, filtered by RLS |
| anon USAGE on private schema | no |
| anon SELECT on private.card_search_terms | no |
| public.lookup_published_card_indexed | SECURITY DEFINER |
| anon EXECUTE public lookup RPC | yes |

**Finding:** H.24 SECURITY INVOKER replacement is compatible with the live cards SELECT policy, and the private search index is not accessible to anon. The existing public SECURITY DEFINER function remains a live advisor warning until replaced. Published cards are intentionally readable through Supabase Data API, even when LearnTranslate's server-side route is used.

**Decision:** H.24 + H.25 only, no H.26 public term table. The H.24 function scans published card JSON for reverse English senses; H.25 indexes may not accelerate that path. Do not claim production-scale indexed performance until EXPLAIN results are inspected.

**Next action:** obtain explicit owner approval for production DDL after confirming a recoverable backup. Merge of this report is not approval to change production. Keep `CARD_INDEXED_SEARCH_ENABLED` off until after role-scoped functional tests and performance checks.
