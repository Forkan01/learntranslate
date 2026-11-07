# V1-H.23 — Indexed-search activation gate

Production read-only inspection on 2026-11-07: 24 published cards, 64 index terms, 24 indexed cards. The live RPC returned expected results for invoice, die Rechnung, der Rechnung (0), Rechnungen, complaint, I passed the exam., and an absent word. This is a representative sample, not exhaustive equivalence with the JavaScript fallback.

**Security blocker:** Supabase security advisors now warn that `public.lookup_published_card_indexed` is a SECURITY DEFINER RPC executable by anon and authenticated. Unlike the previous RLS event trigger, this function is a real public API. It filters published rows but runs with owner privileges and bypasses RLS. Do not treat these warnings as resolved. The private index has RLS enabled with no policies, which is intentional deny-by-default and produces an informational advisor finding.

**Activation remains blocked** pending a reviewed least-privilege redesign or explicit security exception, and end-to-end comparison of indexed and legacy search using the publishable key. No production SQL or Vercel environment variable is changed by this PR.

## Next engineering milestone

Explore an RLS-respecting SECURITY INVOKER RPC over public.cards with a suitable expression index, or a narrowly scoped private index access model. Benchmark on a realistic dataset before replacing the current public SECURITY DEFINER function. Preserve the existing JS fallback until tests and security review pass.
