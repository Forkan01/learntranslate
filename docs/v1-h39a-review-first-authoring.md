# H.39A — Offline manual and bulk card authoring (review first)

## Purpose
Create new Word and Sentence Card drafts on a Windows laptop, validate them,
and prepare review-only SQL for manual inspection. This phase does **not**
create a public admin page, connect a service-role key to the browser, or write
anything to Supabase automatically.

## Verified database boundary (2026-11-08)
- Supabase `public.cards`: 24 published cards (12 word + 12 sentence).
- `public.cards`, `public.categories` and `public.card_categories` have RLS enabled.
- `anon` and `authenticated` have SELECT privileges only; cards' SELECT policy
  restricts visibility to `status = 'published'`.
- Publishing and editing require a separate, explicit **administrator** design,
  not merely any signed-in Supabase user.

## Manual creation
From the repository root in PowerShell:

```powershell
node scripts/create-card-draft.mjs word "die Entscheidung" work-career --out data/vocabulary/decision-draft.json
node scripts/create-card-draft.mjs sentence "Ich hätte gern einen Termin." conversations --out data/vocabulary/appointment-draft.json
```

Optional fourth positional argument `en` generates an English→German draft:

```powershell
node scripts/create-card-draft.mjs word "habit" daily-life en --out data/vocabulary/habit-draft.json
```

The script generates a **single-card JSON array** that matches the bulk format.
It deliberately leaves meaning, explanations and examples blank. Fill all
placeholders accurately before importing. German noun articles are copied only
when explicitly present in the supplied term, never guessed; add the plural
manually. It refuses to overwrite an existing file.

## Batch creation
Prepare a JSON **array** of 1–1000 entries in the same shape as
`data/vocabulary/starter.json`. Each entry must include:

```json
{
  "content": {
    "schemaVersion": 1,
    "type": "sentence",
    "sourceLanguage": "de",
    "targetLanguage": "en",
    "term": "Es kommt darauf an.",
    "translation": "It depends.",
    "naturalMeaning": "The answer depends on circumstances."
  },
  "categories": ["conversations"]
}
```

For Word Cards, add validated `grammar` and exactly five bilingual `examples`.
German-source nouns require a curated article and plural. Category slugs must
already exist in Supabase, and duplicate search keys inside a batch are rejected.

```powershell
node scripts/build-vocabulary-import.mjs data/vocabulary/starter.json --check
node scripts/build-vocabulary-import.mjs data/vocabulary/starter.json > learntranslate-review-import.sql
```

Review the SQL file before doing anything further. **Generating this file
does not execute SQL or contact Supabase.** It emits:

1. A database transaction with category preflight assertions.
2. Inserts into `public.cards` with `status = 'review'` exclusively.
3. A link insert only for card IDs returned by the new card insert.
4. `ON CONFLICT (search_key) DO NOTHING`: existing published content and
   category associations are left untouched if a search key already exists.

Only after human review should a database administrator deliberately execute
the SQL using a privileged Supabase SQL editor. **Do not** copy service-role
credentials into Next.js client code. The importer does not automatically
publish anything or edit existing cards.

## Limitations and next milestones
- Structural validation is not a substitute for checking German grammar,
  naturalness, translation accuracy, and example quality.
- H.39A does not provide editing/publishing UI, CSV import, or admin user
  authentication. Existing cards are intentionally never overwritten.
- **H.39B:** define a real admin authorization boundary (verified Supabase
  identity + server-controlled administrator allowlist or `app_metadata` role),
  CSRF/origin checks, rate limits and audit logging before exposing mutations.
- **H.39C:** a protected pastel-style card editor, review queue, edit and bulk
  import controls. Publishing must be a separate explicit action with a
  validation gate, and should never be driven solely by public sign-in.
- Use local laptop lint, TypeScript, Next.js build and tests until GitHub Actions
  hosted-runner allowance is restored.

## Tests
```powershell
node --test tests/v1h39a-offline-admin-authoring.test.mjs
node --test tests/*.test.mjs
npx tsc --noEmit
npm run lint
npm run build
```
