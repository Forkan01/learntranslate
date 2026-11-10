# H.39D.4.2 — Assign existing topic categories to individual cards

## Goal
Connect the existing 12 public topic/situation categories to cards via the
existing `public.card_categories` association table.

Workflow: Create/Import Draft → Edit → **Assign Topics** → Review → Publish.

- Open `/admin`, select any card, then **Assign topic categories**.
- `/admin/topics/[id]` lists categories from Supabase with checked
  assignments for that card.
- Check **Travel & Transport**, **Daily Life**, or any number of existing topics.
- Uncheck to remove a single assignment. Each click is a single, verified
  database operation. Refresh to see the authoritative current state.
- Cards of all statuses can be categorized. Only **published** cards appear in
  public topic browsing, enforced by existing Supabase RLS and the
  public `/api/categories?slug=...` query.
- Published card topic changes are public immediately. No auto-publishing,
  card-content edits, or status changes are performed by this milestone.
- No AI, generation costs, new category creation or bulk reclassification.

## Security
`GET /api/admin/cards/[id]/topics`:
- Uses the exact server-verified Supabase Auth administrator identity.
- Requires existing `ENABLE_LEARNTRANSLATE_ADMIN_REVIEW_READ=true`.
- Reads only the selected card, up to 100 categories and up to 100 links;
  validates every returned UUID and relationship, including unpublished ones.
- Returns no credentials and sets private no-store cache headers.

`POST` (add one topic) and `DELETE` (remove one topic) to the same path:
- Recheck exact administrator identity and strict browser origin **before** reading JSON.
- Require new disabled-by-default server flag
  `ENABLE_LEARNTRANSLATE_ADMIN_CATEGORY_WRITE=true`.
- Body is strictly `{"categoryId":"<uuid>"}`, bounded to 1 KiB.
- Re-read the current card and available categories server-side, reject
  unknown categories, and avoid mutating already-assigned/absent links.
- POST inserts one `card_categories` row. DELETE includes both
  `card_id=eq.<id>` **and** `category_id=eq.<id>` filters.
- Confirm exactly one matching returned link. Duplicate/conflicting actions
  return 409; failed/ambiguous writes never auto-retry.
- No write to `cards`, `categories`, card identity, content, or status.
- The privileged service-role key never enters a browser bundle.

## DB permissions — do not grant before passing local tests
The current database state was verified:
- `service_role` may SELECT from `cards`, but initially has **no**
  privileges on `categories` or `card_categories`.
- `anon` and `authenticated` may SELECT public categories and published-card
  relationships; they cannot INSERT or DELETE category links.
- Row Level Security is enabled. Existing link SELECT policy shows only
  memberships for published cards.

After successful local lint/build/test review, a **separate** controlled
activation may grant only these privileges:

```sql
GRANT SELECT ON TABLE public.categories TO service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.card_categories TO service_role;
```

Do **not** grant write privileges to `anon` or `authenticated`.
Do not deploy the category write flag to Vercel Production until audit logging,
distributed rate limiting and launch review are completed. This first step
keeps admin writes only on the user's trusted local machine.

## Windows checks
```powershell
git switch main
git pull --ff-only origin main
git fetch origin
git switch --track origin/feature/v1-h39d4b-card-topic-assignment

node --test tests/v1h39d4b-card-topic-assignment.test.mjs
node --test tests/*.test.mjs
npm run lint
npm run build
npx tsc --noEmit
```

Do not merge the PR before these pass and live browser testing succeeds.

## Controlled browser verification AFTER grants
Keep existing private admin/read settings. In git-ignored local `.env.local`:

```dotenv
ENABLE_LEARNTRANSLATE_ADMIN_REVIEW_READ=true
ENABLE_LEARNTRANSLATE_ADMIN_CATEGORY_WRITE=true
```

Restart `npm run dev`. In `/admin`, filter **Draft**, select
**die Fahrkartenkontrolle**, and open **Assign topic categories**. Check
**Travel & Transport**, refresh and verify it stays selected. Check a second
topic, then uncheck it and verify only that second assignment disappears.

Verify `/api/categories?slug=travel-transport` **does not** reveal the draft.
The 25 published card contents and counts should remain unchanged.

Once a completed card is manually reviewed and published, its assigned topics
can show it in public category browsing. No category writes will publish a card.
