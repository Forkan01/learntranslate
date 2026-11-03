# V1-C.3 — Gemini card generation (opt-in only)

- Reuses existing `GEMINI_API_KEY` and `GEMINI_MODEL`.
- `POST /api/cards/generate` accepts `{term,source,target,type}`.
- Validates model JSON against a constrained word/sentence shape; word cards require five bilingual examples.
- Does **not** write to Supabase and does **not** publish generated cards.
- Disabled unless `ENABLE_CARD_GENERATION=true`. Do not set this in public production until abuse controls (rate limits, quotas, and appropriate authentication) are in place.
- Next: runtime tests, category-aware review queue and server-only persistence, before enabling end-user generation.
