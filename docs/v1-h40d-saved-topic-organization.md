# H.40D — Organize and browse saved cards by situation

## Goal
Complete LearnTranslate's existing **Search → Learn → Save** journey with
simple topic-based organization. Keep the two top-level navigation destinations:
**Search** and **Categories**. Do not add quizzes, progress pages or a third tab.

## Changes
- Categories → **Saved on this device** now offers **Find a saved card**
  (matches source term and its translation, case-insensitively), plus
  **Filter by topic** with All saved cards, Unsorted and 12 everyday situation
  topics already used by the Categories browsing UI.
- Each Saved card has an **Organize by topic** selector, placed outside the
  approved H.40A/B pastel card body. Choose a topic or Unsorted at any time.
- Cards saved from a published category are assigned to that category's topic
  automatically when no saved topic was already chosen. Search-saved cards
  start Unsorted, unless previously organized.
- Topic choices persist across reloads in a **separate browser-only companion
  key**, `lt:saved-card-topics:v1`. Existing saved cards remain untouched in
  `lt:cards:v1`; the card schema, published category assignments and Supabase
  are not modified.
- Removing a Saved card also attempts to delete that card's topic assignment.
  Cross-tab storage events refresh both cards and topics.
- Filtering never deletes cards. An empty filter shows a helpful no-results
  message; existing cards with no topic still appear under All/Unsorted.
- Word Cards retain Grammar, Examples, Synonyms & Antonyms and Other Forms;
  Sentence Cards retain Grammar, Examples and Other Forms.

## Storage integrity
- Card identity for topic organization uses the same properties as Save:
  type, source language and original term (encoded as a JSON tuple to avoid
  delimiter collisions).
- The topic parser rejects malformed/unknown labels and is bounded to
  200 entries / 100 KB. No stored topic text is injected as HTML.
- The preset topic list remains available when the public category API
  cannot be reached, so previously saved cards can still be browsed offline
  after the app is loaded.
- The companion topic key is local to a browser/device. This is **not**
  cloud sync; another browser/device will not automatically share topics.
- An explicit Unsorted selection clears the local topic mapping.
- This step doesn't change API endpoints, database roles, generation limits,
  billing, auth, or Vercel deployment.

## PowerShell validation

```powershell
git switch main
git pull --ff-only origin main
git fetch origin
git switch --track origin/feature/v1-h40d-saved-topic-organization

node --test tests/v1h40d-saved-topic-organization.test.mjs
node --test tests/v1h40c-saved-card-management.test.mjs
node --test tests/v1h40b-category-saved-card-ui.test.mjs
node --test tests/*.test.mjs
npm run lint
npx tsc --noEmit
npm run build
npm run dev
```

## Manual acceptance

1. At `http://localhost:3000/categories`, open **Saved on this device**.
   Previously saved cards should all remain visible under **All saved cards**
   and appear under **Unsorted** until given a topic.
2. Assign a saved card to **Conversations**. Filter to that topic and confirm
   only matching cards appear; filter to **Unsorted** to see unassigned cards.
3. Search within Saved using both the source-language term and a translation.
   Search is case-insensitive, and the result count reflects the filter.
4. Change that card's topic to **Work & Career** and verify it moves into the
   chosen filter without deleting the saved card. Reload and verify persistence.
5. Save a new published card from a known topic category; confirm the card
   inherits the category topic. Existing manual assignments must be preserved
   when a card is saved again from a category.
6. Save a new published card from Search. It should appear under Unsorted.
   Remove a tagged Saved card; confirm its topic mapping is cleared and the
   other saved cards are unchanged.
7. Check a narrow mobile layout, Word/Sentence Card accordions, offline Saved
   browsing (after app is loaded) and cross-tab refresh.

**Do not merge** until local tests and browser acceptance pass. No GitHub
Actions or Vercel deploy is required for this local-validation milestone.
