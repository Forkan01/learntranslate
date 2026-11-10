# H.40B — Consistent Category and Saved Card UI

## Intent
Apply the approved H.40A translation-first pastel learning cards to both
public topic categories and the local saved-card collection. Keep the public
navigation **Search** and **Categories** only.

## What changed
- Category tiles and the existing published-only category lookup remain.
- The Categories home now has a **Saved on this device** collection tile.
  It reads the already-used localStorage key `lt:cards:v1` and does not
  introduce a new database, account sync, background generation, or a third
  top-level navigation feature.
- Category and Saved collections render the same `LearningCard` UI:
  large opposite-language translation, smaller original/source term, optional
  secondary senses and sentence context, pronunciation and a compact
  **Explore card** reveal.
- Expanded Word Cards show four collapsed-by-default pastel accordions:
  Grammar, Examples (actual count), Synonyms & Antonyms, and Other Forms.
- Expanded Sentence Cards show Grammar, Examples (actual count), and
  Other Forms; natural meaning remains visible in the card header.
- Bilingual examples have numbered source sentences and translated text, not
  redundant "German" / "English" labels.
- Synonyms/antonyms are dedicated word-chip lists and are not repeated under
  Other Forms; never guess missing antonyms.
- The **Save this card** action in category view writes the exact same
  device-local format as Search, keeping the last 200 cards and deduplicating
  on source language, type and term.
- Previously saved cards remain available in the Saved collection. Storage
  events refresh that collection across tabs.

## Scope and privacy
- Only client-side category/saved presentation and tests/docs change.
- No changes to `/api/categories` or the published-only database filter.
- No Supabase, credentials, storage migration, permission changes, AI calls,
  schema changes, feature flag changes, or Vercel deployment.
- Saved cards are **per-browser/device**. They are not organized into
  persistent topic categories or synchronized between devices in this step.
- Legacy `LegacyHome.tsx` vocabulary remains untouched and unused by the
  current Search/Categories homepage.

## Local PowerShell checks

```powershell
git switch main
git pull --ff-only origin main
git fetch origin
git switch --track origin/feature/v1-h40b-category-saved-card-ui

node --test tests/v1h40b-category-saved-card-ui.test.mjs
node --test tests/v1h40a-pastel-collapsible-cards.test.mjs
node --test tests/v1h38-translation-first-cards.test.mjs
node --test tests/*.test.mjs
npm run lint
npx tsc --noEmit
npm run build
```

## Visual and functional acceptance
Use `npm run dev` and open `http://localhost:3000/categories`:

1. Select a category with published cards. Each card should show the
   opposite-language translation as the large headline and the original
   word/sentence smaller below it.
2. Tap **Explore card** and independently open Grammar, Examples,
   Synonyms & Antonyms (for Word Cards only), and Other Forms.
   Verify sections are collapsed by default and chevrons rotate.
3. Confirm Word examples show correct counts and bilingual sentences without
   text labels beside the translations, including optional example notes.
4. Confirm Sentence Cards have three sections, with contextual meaning
   visible and any word-by-word notes preserved.
5. Save a category card. Return to Categories, tap **Saved on this device**,
   and confirm the saved card appears with the exact same appearance.
6. Test with a card previously saved from Search; it should also appear here.
   Search again, save another card, and confirm both use the same storage.
7. Check mobile width (about 375 px), long sentences, empty synonym/antonym
   arrays, zero sentence examples, and empty Saved state.

**Do not merge** until local tests and visual acceptance pass. We use
local validation instead of paid GitHub Actions compute; no Vercel deployment
is required for this step.
