# H.40C — Saved Card management

## Goal
Complete the existing Search → Learn → Save experience without introducing
new navigation, cloud storage, card schemas or provider calls.

## Changes
- **Search** now recognizes when a returned published Word or Sentence Card was
  saved earlier in this browser and immediately displays
  `✓ Saved on this device`, instead of implying it must be saved again.
- The Categories → **Saved on this device** collection now offers an explicit
  **Remove from saved** action on each saved card, even when card details are
  collapsed.
- The Remove action matches the existing save identity (source language,
  card type and source term), removes only that matching card from the
  existing browser key `lt:cards:v1`, and refreshes the view immediately.
- Remaining cards retain their saved order; empty Saved collection uses
  the already implemented empty state.
- A polite status notice confirms removal, and cards can be saved again
  from Search or any published category.

## Intentional limits and safety
- No separate Saved navigation tab, quizzes, ads, new AI generation or API
  changes; the app still exposes Search and Categories.
- No Supabase writes, schema migration, API endpoints, auth changes,
  `NEXT_PUBLIC_*` secrets or deployment.
- Saved Cards remain device-local using the existing `lt:cards:v1`
  `localStorage` key; there is no cloud sync.
- Only a deliberate click on **Remove from saved** removes a card.
  We do not bulk-delete data or clear the full storage key.
- Existing H.40A and H.40B card layout/accordions remain unchanged.

## Local PowerShell verification

```powershell
git switch main
git pull --ff-only origin main
git fetch origin
git switch --track origin/feature/v1-h40c-saved-card-management

node --test tests/v1h40c-saved-card-management.test.mjs
node --test tests/v1h40b-category-saved-card-ui.test.mjs
node --test tests/v1h40a-pastel-collapsible-cards.test.mjs
node --test tests/*.test.mjs
npm run lint
npx tsc --noEmit
npm run build
npm run dev
```

## Local browser acceptance
1. Open `/search`, search a published card you've already saved.
   Confirm it immediately says **✓ Saved on this device**.
2. Search a different, unsaved published word. Confirm its button says
   **♡ Save this card**. Save and search it again; status should persist.
3. Open `/categories` → **Saved on this device**. Confirm existing Word
   and Sentence Cards still display normally.
4. On a saved card, click **Remove from saved** while its details are
   collapsed. Confirm only that card disappears and the saved count changes.
5. Confirm a different card stays saved; navigate back and check again.
   If the last card is removed, the existing helpful empty state appears.
6. Save the removed card again from Search or its published category.
   Confirm it reappears in Saved. Check narrow mobile layout.
7. Optionally open two browser tabs to confirm the existing storage-event
   refresh updates the Saved collection when one tab changes storage.

Only source-level structural checks were performed when preparing this PR.
Do not merge before local tests and visual acceptance.
