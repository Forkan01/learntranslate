# V1-B.4 — First-batch editorial review and publication

Review scope: `data/vocabulary/curated-batch-01.json` (12 noun cards, 12 sentence cards, 12 topic categories).

## Editorial adjustments
- **Beschwerde**: distinguish a general complaint from plural medical **Beschwerden** (symptoms/discomfort). Preserve its health-category context.
- **Gespräch**: replace an unnatural sample sentence with `Ich möchte ein kurzes Gespräch mit dir führen.`

## Publication checks
- Word cards: exactly five bilingual examples, valid noun article and plural.
- Sentence cards: natural English translation and context explanation.
- Both types: consistent source/target languages, unique search keys, valid category links.
- Publish only the 24 explicitly reviewed search keys, never all rows with status `review`.
- After publication, verify 24 published cards, 24 category links, and read-only public RLS.
- Imported cards remain in GitHub as the editorial source of truth. Future corrections should update both GitHub and Supabase.

## Follow-ups
- Add semantic validation and richer sentence-card explanations before scaling to 120 cards.
- Build a search API that checks the shared database first, then uses AI only on a miss.
- Fix existing Supabase security-advisor warning for `public.rls_auto_enable()` before production release.
