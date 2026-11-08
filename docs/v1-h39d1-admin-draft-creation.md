# H.39D.1 — Create private Word and Sentence Card drafts

## Scope
The existing read-only `/admin` dashboard now links to `/admin/new`.
Only the verified administrator can use the new `POST /api/admin/drafts` route.
A successful request inserts exactly **one** `public.cards` row with
`status = 'draft'`; it cannot publish, update, upsert, delete, or assign categories.

- Word: German→English or English→German, term, translation, part of speech,
  optional article/plural, five bilingual example slots and usage notes.
- Sentence: language direction, term, translation, natural meaning, grammar notes.
- Drafts may be incomplete; publication-time quality validation comes later.
- No AI generation, category association, editing or publishing in H.39D.1.
- Duplicate search keys result in HTTP 409 (existing cards never overwritten).

## Security and rollout boundaries
- Server revalidates the **HttpOnly Supabase** session and exact admin UUID
  on every POST before reading a body or reaching the database.
- A strict configured-origin/CSRF check rejects cross-origin POSTs.
- JSON required; request body hard-capped at **16 KiB**, including chunked bodies.
- Strict allowlisted fields. Server constructs `search_key`, both languages,
  `schemaVersion` and literal `status='draft'` itself; no user-supplied
  status, ID, timestamps, search key or user ID is accepted.
- Separate `ENABLE_LEARNTRANSLATE_ADMIN_DRAFT_WRITE=true` server-only gate
  is OFF by default. It is *independent* of the existing admin read flag.
- Only the server uses the legacy `SUPABASE_SERVICE_ROLE_KEY`. Never put
  this key in `NEXT_PUBLIC_` variables, the browser, a screenshot, or Git.
- No write grants, Vercel settings, migrations, or DB rows are changed by
  opening this PR. Public search still sees published cards only.
- H.39D.1 is a **local-only validation milestone**. Keep draft writing
  DISABLED in production until durable audit logging, distributed rate
  limiting, and the publishing workflow have been reviewed.

## Local laptop tests (before enabling any write)
```powershell
git switch main
git pull --ff-only origin main
git fetch origin
git switch --track origin/feature/v1-h39d1-admin-draft-creation

node --test tests/v1h39d1-admin-draft-creation.test.mjs
node --test tests/*.test.mjs
npm run lint
npm run build
npx tsc --noEmit
```
Do not merge before checking the local results. GitHub-hosted CI minutes
were exhausted in previous milestones.

## Future local activation (after test review)
Existing local values remain:
```dotenv
ENABLE_LEARNTRANSLATE_ADMIN=true
LEARNTRANSLATE_ADMIN_USER_ID=<the existing admin UUID>
ENABLE_LEARNTRANSLATE_ADMIN_REVIEW_READ=true
SUPABASE_SERVICE_ROLE_KEY=<private legacy service_role JWT>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
Only when the initial tests pass and the local admin write is approved:
1. Add `ENABLE_LEARNTRANSLATE_ADMIN_DRAFT_WRITE=true` to **local**
   `.env.local`, never Vercel Production.
2. The database administrator separately grants only
   `GRANT INSERT ON TABLE public.cards TO service_role;` (SELECT was
   previously granted). This is deliberately NOT done by the PR.
3. Restart Next.js, sign in using the existing browser session, open
   `http://localhost:3000/admin/new`, and create a unique test card.
4. Select **Status → Draft** on `/admin` to verify its contents. Drafts
   must never appear on public search.
5. If a write times out, check the Draft filter before trying again:
   a server/network error does not prove no insert occurred.
6. Leave production write setting unset/off. The next milestone will
   implement editing and then explicit review/publish with separate gates.

## HTTP responses
- 201 — inserted exactly one private draft.
- 400/415 — malformed fields, body size or media type.
- 401 — unauthenticated; 403 — non-admin or untrusted origin.
- 404 — admin/draft write feature not enabled.
- 409 — normalized search key already exists.
- 503 — database permission/configuration, transport or uncertain outcome;
  backend details and credentials are not returned to the browser.
