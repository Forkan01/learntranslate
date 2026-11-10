# H.40A — Pastel, hand-drawn accordion layout for public Search Cards

## Intent
Match the approved mobile-first LearnTranslate card design without changing
any API, card schema, storage, authentication or publication behavior.

- Keep the **opposite-language translation large and always visible** at
  the top, including curated secondary meanings and the original searched text.
- Place exactly four stacked, rounded, pastel teaching containers underneath:
  **Meaning**, **Grammar**, **Examples (actual count)** and **Other Forms**.
- All four containers are native HTML `<details>` elements, collapsed by
  default, independently expandable by keyboard, mouse and touch.
- Meaning: primary and secondary translations for Word Cards, natural meaning
  for Sentence Cards; curated usage notes when available.
- Grammar: Word part of speech, German noun article/plural and known verb
  forms; Sentence grammar breakdown and word-by-word explanations.
- Examples: list the actual curated bilingual example count. Five examples
  for complete approved Word Cards; a truthful smaller/zero count for Sentence
  Cards when the data does not include five.
- Other Forms: Word synonyms, antonyms, related words and curated common
  expressions, or Sentence alternatives. Never invent content for missing
  fields; show a gentle empty state instead.
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
   appear all collapsed.
2. Expand Meaning, Grammar, Examples, Other Forms one at a time. Confirm
   each opens and closes on tap, all example translations are visible, and
   noun article and plural are readable where present.
3. Search a known published German Sentence Card, such as
   `Es kommt mir bekannt vor.`. Verify natural meaning, grammar notes,
   and a graceful empty state when optional examples/alternatives are absent.
4. Switch to English → German, search a known published English sense,
   and confirm **German** is the headline without reversing the source
   examples/grammar incorrectly.
5. Save one card; refresh search and verify the existing storage behavior
   is unchanged. Check narrow mobile width; no text overflow, headings
   and controls remain legible.

Do not merge until tests and visual acceptance pass. GitHub Actions not needed.
