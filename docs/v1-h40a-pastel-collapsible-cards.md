# H.40A — Pastel, hand-drawn accordion layout for public Search Cards (simplified)

## Intent
Match the approved mobile-first LearnTranslate card design without changing
any API, card schema, storage, authentication or publication behavior.

- Keep the **opposite-language translation large and always visible** at
  the top, including curated secondary meanings and the original searched text.
- Do not repeat the translation in a separate Meaning container. For Sentence
  Cards, keep the additional natural/contextual explanation visible just
  below the primary translation. Preserve all curated usage notes in
  **Other Forms**.
- Display **four** stacked, rounded, pastel teaching containers for **Word Cards**:
  **Grammar**, **Examples (actual count)**, **Synonyms & Antonyms**, and **Other Forms**.
  Sentence Cards retain three sections: Grammar, Examples and Other Forms.
  All are collapsed by default.
- Each container is a native HTML `<details>` element, collapsed by
  default, independently expandable by keyboard, mouse and touch.
- Use compact, consistent chevron-down **SVG icons** like the approved
  illustration, aligned to the right. Icons rotate when expanded; do
  not render the former oversized round arrow badges / text glyphs.
- Grammar: Word part of speech, German noun article/plural and known verb
  forms; Sentence grammar breakdown and word-by-word explanations.
- Examples: list the actual curated bilingual example count. Five examples
  for complete approved Word Cards; a truthful smaller/zero count for Sentence
  Cards when the data does not include five. Do not repeat "German" / "English"
  language badges next to each bilingual example; keep source then translation.
- Synonyms & Antonyms (Word Cards only): render the existing curated arrays in separate
  readable word chips. Never fabricate a direct opposite; use a friendly empty state
  if either array is empty. This section does not appear on Sentence Cards.
- Other Forms: Word related words, curated common expressions, usage notes,
  or Sentence alternatives. Synonyms/antonyms are no longer duplicated here.
  Never invent content for missing fields; show a gentle empty state instead.
- Preserve the existing **Listen** button and **Save this card** action.
- Search still returns published-only results and existing direction-aware
  German ↔ English presentation.
- Retain a clean Search → Learn → Save public experience with no extra
  navigation, quizzes, dashboards or generation.

## Scope deliberately limited
This is the **public Search result card**. The category browsing cards
currently have a separate expandable view. Following this test, H.40B can
reuse this approved style in categories and locally saved card views, avoiding
a disruptive second large change in the same PR.

No new database flags, Supabase policies, backend services, API calls, imports,
dependencies, or Vercel deploys are involved.

## Review and verification
- New focused tests: `tests/v1h40a-pastel-collapsible-cards.test.mjs`.
- Existing `tests/v1h2-card-presentation.test.mjs` updated to keep the
  same data coverage while matching the new structure.
- Existing H.38 translation-first tests must remain passing.

```powershell
git switch main
git pull --ff-only origin main
git fetch origin
git switch --track origin/feature/v1-h40a-pastel-collapsible-card-ui

node --test tests/v1h40a-pastel-collapsible-cards.test.mjs
node --test tests/v1h2-card-presentation.test.mjs
node --test tests/v1h38-translation-first-cards.test.mjs
node --test tests/*.test.mjs
npm run lint
npm run build
npx tsc --noEmit
```

## Local browser acceptance
Start with `npm run dev`; use `http://localhost:3000/search`:
1. Search a published German word with examples. Confirm **English** is
   the largest text, German original is smaller, and four pastel sections
   appear all collapsed (three for Sentence Cards).
2. Expand Grammar, Examples, Synonyms & Antonyms, and Other Forms one at a time.
   Confirm they open/close on tap, all example translations are visible without
   redundant language badges, and noun article and plural are readable.
   Confirm the new section uses only existing curated synonyms/antonyms and shows
   independent empty states if either list is absent, without duplicating them
   in Other Forms.
3. Search a known published German Sentence Card, such as
   `Es kommt mir bekannt vor.`. Verify natural meaning is visible under the translation, grammar notes,
   and a graceful empty state when optional examples/alternatives are absent.
   Confirm the Sentence Card has no Synonyms & Antonyms section.
4. Switch to English → German, search a known published English sense,
   and confirm **German** is the headline without reversing the source
   examples/grammar incorrectly.
5. Save one card; refresh search and verify the existing storage behavior
   is unchanged. Check narrow mobile width; no text overflow, headings
   and controls remain legible.

Do not merge until tests and visual acceptance pass. GitHub Actions not needed.
