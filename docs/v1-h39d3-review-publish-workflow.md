# H.39D.3 — Review, reject and publish card content (local-only)

## Goal and behavior
Manual flow:

`Create Draft → Edit Draft → Submit for Review → Approve & Publish → Public Search`

Other transitions: `Review → Rejected → Draft` (so rejected cards can be corrected).
Published cards are terminal in H.39D.3: neither the review workflow nor
the draft editor may edit or unpublish them.

Dashboard `/admin` shows review controls beside selected cards:
- Draft: **Submit completed card for review**.
- Review: full structured content inspection, **Reject** or **Approve & Publish**
  with mandatory human accuracy confirmation.
- Rejected: **Return to Draft for corrections**, then edit and resubmit.
- Published: read-only; already searchable by public users.

Only structural validation is automated. Grammar correctness, natural
translations, and example quality **must** be confirmed by the administrator.

## Publication gate
`validatePublishableContent` requires:
- matching schemaVersion/type/term/language direction; nonempty translation;
- Sentence: nonempty natural meaning and, if supplied, valid grammar notes;
- Word: supported part of speech and **five complete bilingual examples**;
- German-source nouns: a valid article and nonempty plural;
- no empty or oversized optional teaching notes.

An incomplete draft cannot submit for review or publish. A card cannot skip
Draft → Review and become immediately Published. Publish also requires explicit
`confirmed: true` and a separate server-only publish flag.

No AI API is used in the workflow.

## Security and concurrency
`POST /api/admin/cards/[id]/review`:
1. Re-checks the Supabase user from the HttpOnly session and the exact
   server-side administrator allowlist.
2. Enforces the configured same-origin write gate; JSON only, max 2 KiB.
3. Requires `ENABLE_LEARNTRANSLATE_ADMIN_REVIEW_WORKFLOW=true`,
   disabled by default. Publishing additionally requires
   `ENABLE_LEARNTRANSLATE_ADMIN_PUBLISH=true`, also disabled by default.
4. Accepts ONLY `{action,expectedUpdatedAt,confirmed}`. The server maps
   named actions to specific legal status transitions.
5. Re-reads the latest card and checks its status, completeness and version.
6. Atomically changes **only** `status` and `updated_at` using PostgREST
   filters `id=eq.<uuid>&status=eq.<from>&updated_at=eq.<old-version>`.
   A stale version produces HTTP 409 rather than overwriting another change.
7. Checks exactly one updated card and the expected new status. Never
   auto-retry a timeout (the outcome might be uncertain).

The service-role key is server-only. No new frontend secrets, signed-in user
permissions or anonymous DB permissions. Public Search continues to filter
`status=published` only.

## Important scope restrictions
- **No Supabase SQL, grant, migrations, rows or Vercel Production settings
  are modified by opening this PR.**
- Existing Supabase role has SELECT, INSERT and column-level
  UPDATE(content,updated_at) but **does NOT yet have UPDATE(status)**.
- After all local tests pass, **only then** review an additional narrow grant
  for controlled localhost testing:

```sql
GRANT UPDATE (status) ON TABLE public.cards TO service_role;
```

This is a project-wide privileged DB permission: the local feature flags
limit Next.js route behavior, not the service-role credential itself.
Keep the legacy service-role JWT exclusively on trusted backend servers.
Never add either H.39D.3 flag to Vercel Production until audit logging,
abuse/rate controls, role boundaries, and release review are completed.

Published cards without categories ARE available through direct public Search,
but they won't automatically appear in topic/category browsing until category
association is implemented (planned H.39D.4).

## Windows local verification
```powershell
git switch main
git pull --ff-only origin main
git fetch origin
git switch --track origin/feature/v1-h39d3-review-publish-workflow

node --test tests/v1h39d3-review-publish-workflow.test.mjs
node --test tests/*.test.mjs
npm run lint
npm run build
npx tsc --noEmit
```
Do **not** merge until checks and controlled browser testing pass.

## Controlled manual test AFTER granting status permission
Add to your git-ignored local `.env.local` only:

```dotenv
ENABLE_LEARNTRANSLATE_ADMIN_REVIEW_WORKFLOW=true
ENABLE_LEARNTRANSLATE_ADMIN_PUBLISH=true
```

The existing administrator/read/edit settings remain unchanged. Stop and
restart `npm run dev`. In `http://localhost:3000/admin`:
1. Select **Draft** and choose a **complete** test card; click **Submit**.
2. Select **Awaiting review** and open the card.
3. Inspect all card details. Use **Reject** if wrong, then **Return to Draft**,
   fix and resubmit.
4. To publish, check the explicit accuracy confirmation, then
   **Approve & Publish** once.
5. Verify the card appears under **Published** and in public `/search`.
6. Verify the original published cards were not altered. Remember that the
   test uses the same Supabase data seen by the hosted application once
   a card is Published; select a genuinely suitable card before publishing.

A failed response does not prove no transition occurred: refresh the admin
list before trying a second time. No automated cleanup/deletion occurs.
