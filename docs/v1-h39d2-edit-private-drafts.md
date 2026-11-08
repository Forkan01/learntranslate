# H.39D.2 — Edit existing private draft cards (local, default off)

## What changes
- The admin review dashboard now offers **Edit private draft** only for status `draft`.
- `/admin/edit/[id]` loads one verified private draft, with term/type/direction read-only.
- Word drafts: change translation, part of speech, article, plural, five bilingual examples, usage notes.
- Sentence drafts: change translation, natural meaning and grammar notes.
- No AI, publishing, category editing, term renaming, deletion or modification to published cards.
- Edits preserve ancillary curated content fields, e.g., `pronunciation` or `alternatives`.

## Boundary and security
- Admin routes use the verified HttpOnly Supabase session and exact server allowlist.
- `GET /api/admin/drafts/[id]` filters `status=eq.draft`.
- `PATCH /api/admin/drafts/[id]` re-verifies administrator access and same-origin/CSRF,
  rejects non-JSON/oversized (>16 KiB) bodies, and fetches the latest draft.
- Only `content` and `updated_at` can be patched. Immutable ID, card type,
  source/target languages, term, search key, status and categories are never
  in the body, and client attempts to supply them are rejected.
- Both `id=eq.<uuid>` and `status=eq.draft` are required PostgREST filters.
  `updated_at=eq.<version>` provides optimistic concurrency; zero updated rows
  gives HTTP 409 so stale browser tabs cannot silently overwrite a new revision.
- Version-locked patch uses `Prefer: return=representation` and validates
  one returned draft before claiming success.
- A timeout may be an uncertain write: **do not automatically retry**;
  reload the editor and inspect the stored card before making a new edit.
- New `ENABLE_LEARNTRANSLATE_ADMIN_DRAFT_EDIT=true` server-only flag,
  OFF by default. The existing `ENABLE_LEARNTRANSLATE_ADMIN_REVIEW_READ=true`
  is also required for loading drafts.
- Only the server uses `SUPABASE_SERVICE_ROLE_KEY`. No `NEXT_PUBLIC_`
  secrets and no new role-based access for normal signed-in users.

## Database: deliberately not changed by PR
Current Supabase `service_role` has SELECT and INSERT but **not UPDATE**.
After the PR passes local tests and the user explicitly approves the local trial,
grant *column-level*, not table-wide, UPDATE permission:

```sql
GRANT UPDATE (content, updated_at) ON TABLE public.cards TO service_role;
```

Leave UPDATE for `anon` and `authenticated` denied. Do not grant UPDATE
on `status`, `term`, `search_key`, `type` or other columns. The trigger
`cards_sync_search_terms` executes on content changes; check normal live
behavior after granting. **Do not make this grant before automated tests pass.**

## Laptop verification before any live update
```powershell
git switch main
git pull --ff-only origin main
git fetch origin
git switch --track origin/feature/v1-h39d2-edit-private-drafts

node --test tests/v1h39d2-edit-private-drafts.test.mjs
node --test tests/*.test.mjs
npm run lint
npm run build
npx tsc --noEmit
```
Do not merge until the checks and one local edit test pass.

## Subsequent local activation
Keep `.env.local` ignored by Git. After test review and column-level grant,
add **locally only**:
```dotenv
ENABLE_LEARNTRANSLATE_ADMIN_DRAFT_EDIT=true
```
Keep existing admin/read and draft-create flags unchanged. Restart `npm run dev`;
open `http://localhost:3000/admin`, Status → Draft, select the draft, choose
**Edit private draft**, change a translation or grammar note and save once.
Return to dashboard and re-open the edit page to confirm persisted content.
Verify published cards are unchanged. Test directly opening a published card's
UUID in the editor returns 404 (only do this in your own local admin browser).

## Rollout limits
This is **local-only**. Do not add `ENABLE_LEARNTRANSLATE_ADMIN_DRAFT_EDIT`
to Vercel Production until proper durable audit logging, abuse controls,
published-card protection and the explicit review/publish workflow are ready.
