# H.39D.4.1 — Bulk import bilingual pairs as private draft cards

## Why this is staged
Bulk importing and topic/category assignment touch different database tables.
H.39D.4.1 safely creates batches of **draft cards only**. H.39D.4.2 will
implement administrator topic assignments using the existing `categories`
and `card_categories` tables. No category changes or grants are required now.

## UI
Visit `/admin/bulk` from `/admin`.

- Select **Word Cards** or **Sentence Cards**, and German→English or English→German.
- Paste 1–20 bilingual pairs with **one pair per line**:
  ```text
  der Bahnhof | train station
  verpassen | to miss
  pünktlich | punctual
  ```
- Spreadsheet tab delimiters also work: `term<TAB>translation`.
- The preview shows exactly what is about to be created.
- Extra blank lines are ignored. Duplicate normalized terms, missing
  translations, bad separators, more than 20 rows or large text are rejected.
- Word drafts start with partOfSpeech=other and **five empty bilingual examples**;
  Sentence drafts start with blank naturalMeaning. The existing draft editor
  must complete these before the quality gate permits review/publishing.
- Neither a batch nor its components can be published during import.

## Security
- An HttpOnly Supabase session with exact server-side administrator UUID must
  verify before reading the request. Same-origin enforced for the POST.
- Client request is bounded to 20,000 bytes; raw pairs text to 16,000
  characters, at most 20 pairs. No caller-supplied `id`, `status`, `search_key`,
  `content`, metadata or categories.
- Shares the existing proven `parseNewAdminDraft` normalizer and its
  server-created schema fields, status=draft, and canonical search keys.
- Protected behind **both**
  `ENABLE_LEARNTRANSLATE_ADMIN_DRAFT_WRITE=true` and
  `ENABLE_LEARNTRANSLATE_ADMIN_BULK_DRAFT_WRITE=true`, each default off.
- Uses service-role credentials **only on the server**. Nothing public.
- One PostgREST POST of a JSON array: one transaction across the whole
  batch, no upsert, no update, no deletion or category mutation.
- Database `cards_search_key_key` unique constraint prevents conflicting
  terms. If any card already exists, the entire batch is rejected; nothing
  overwrites an existing card.
- A network timeout or unexpected response may leave an uncertain outcome.
  **Check the Draft list before retrying**. Never blindly re-submit.
- This first implementation does not store a durable audit record or enforce
  cross-instance distributed rate limiting. Do not enable it in Vercel
  Production until those protections and release review are in place.

## Existing database
- `service_role` already has `INSERT` on `public.cards` from H.39D.1.
  **No new permissions or SQL changes** are required for H.39D.4.1.
- Existing 25 published cards remain unchanged; new imports are private.
- The 12 existing topic categories and `card_categories` table will be
  reused in H.39D.4.2; category associations are NOT silently created.

## Windows tests (before enabling anything)
```powershell
git switch main
git pull --ff-only origin main
git fetch origin
git switch --track origin/feature/v1-h39d4a-bulk-draft-import

node --test tests/v1h39d4a-bulk-draft-import.test.mjs
node --test tests/*.test.mjs
npm run lint
npm run build
npx tsc --noEmit
```

## Controlled local trial AFTER successful tests
Add in your git-ignored local `.env.local` only:
```dotenv
ENABLE_LEARNTRANSLATE_ADMIN_BULK_DRAFT_WRITE=true
```
Retain `ENABLE_LEARNTRANSLATE_ADMIN_DRAFT_WRITE=true` and existing
administrator configuration; no Vercel settings should change.
Restart `npm run dev`.

Under `http://localhost:3000/admin/bulk` paste two **new** bilingual pairs,
preview and create once; confirm that exactly two new cards appear when
selecting **Draft** in `/admin`. Open them with Edit Draft and verify the
five Word example slots, or blank Sentence meaning, as expected.

Do **not** merge the PR until local tests and one batch trial pass.
