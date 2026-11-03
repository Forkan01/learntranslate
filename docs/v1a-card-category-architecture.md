# LearnTranslate V1-A — Approved card and category architecture

## Product boundary
Exactly two primary features: **Search** and **Learn by Category**. No lessons, practice mode, quizzes, streaks, progress dashboard, or separate account tab. The approved four-screen pastel/hand-drawn mockup is the visual target. Authentication work in PR #28 remains unmerged and is NOT a prerequisite for this milestone.

## Shared card model
Two discriminated content variants in `src/lib/cards/schema.ts`:
- **Word**: term, natural translation, part of speech, noun article/plural OR verb-specific grammar, pronunciation, five examples, collapsible grammar/synonyms/antonyms/related words/expressions.
- **Sentence**: term, translation, natural meaning, pronunciation, collapsible grammar and word breakdown, alternatives, optional contextual examples.

Both language directions (`de→en`, `en→de`) supported. Do not infer German noun article from an English noun without validated translation. A word's grammatical fields depend on its part of speech.

## Proposed relational database (V1-B)
- `cards`: UUID primary key, `type`, `source_language`, `target_language`, `term`, `search_key` (unique), `status` (draft/review/published/rejected), `content` JSONB with schemaVersion=1, created/updated timestamps. Check languages differ and type/status are valid.
- `categories`: UUID primary key, unique `slug`, `name`, `description`, `icon`, nullable `parent_id`, `sort_order`. Prevent circular ancestry in administrative workflows.
- `card_categories`: composite PK (`card_id`, `category_id`), foreign keys to both, `sort_order`. A card can appear in multiple categories.
- Optional later: `user_saved_cards` for personal bookmarks, **not** required for category browsing.

No fake card counts: show live counts from published rows only. Category browsing is database-driven, not a local hardcoded list.

## Security / quality gates
1. Enable RLS on every exposed table.
2. Grant `anon` and `authenticated` only SELECT on published cards, public categories and links to published cards. Never permit browser INSERT/UPDATE/DELETE of shared cards.
3. AI output is untrusted. Validate shape, source language, grammatical accuracy, example count, and content length before writing. Store uncertain cards in review status; only published cards are publicly visible.
4. AI generation uses server-only provider credentials, server-side quotas, bounded input, and race-safe deduplication. An API response is not automatically approved content.
5. Canonical lookup key = card type + source language + target language + Unicode-normalized, whitespace-collapsed, locale-lowercased text. Keep original casing and accents in display content. Consider homographs and multiple senses during V1-C: a single key may require multiple senses/variants rather than overwriting.
6. Curated bulk import must be idempotent, reviewable, and tagged to one or more categories. Never expose admin import endpoint to anonymous clients.
7. Preserve existing features in code while replacing visible navigation only in later V1-E.

## Suggested category seed list
Daily Life; Conversations; Feelings & Emotions; Work & Career; Shopping; Food & Restaurants; Travel & Transport; Health; Housing; Education; Technology; German Bureaucracy.

## Acceptance for V1-A
- TypeScript contracts for both card types and category relationship.
- Deterministic normalization/key generation for lookup.
- Documented DB/RLS/AI review design.
- No production DB or UI changes until V1-B/V1-E.
