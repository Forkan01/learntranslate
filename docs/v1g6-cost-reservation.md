# V1-G.6 — Conservative estimated-cost reservation

Before any **private** Gemini generation, reserve a fixed worst-case estimated cost in atomic Redis using `EVAL`. Required server-only environment variables:
- `CARD_GENERATION_MAX_ESTIMATED_MICRO_USD`: positive integer micro-USD reserved per attempt (1 USD = 1,000,000 micro-USD).
- `CARD_GENERATION_DAILY_CAP_MICRO_USD`: positive integer micro-USD UTC daily ceiling.
- Existing `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

Example **illustrative only**, not a Gemini price quote: 4000 micro-USD per attempt ($0.004), 10000 micro-USD daily cap ($0.01). Configure the reservation conservatively based on the actual chosen model's maximum input/output tokens, current provider prices, possible retries, and other charges. If uncertain, do not enable generation.

A missing or invalid config, failed Redis request, or unknown result denies generation. Every admitted attempt consumes a reservation even when the provider fails. Existing request quotas are reserved first; separate atomic cost reservation second. This may consume a request slot when spending is denied, which is deliberately fail-safe.

**Limitations:** This is an **estimated spending reservation, not actual billed spend**. It does not query provider usage, track costs of other projects using the same API key, enforce a provider-level hard cap, or protect against costs exceeding the estimate. Configure provider-side project billing alerts/budgets and a separate dedicated API key/project, verify model-specific maximum costs, and test with a separate LearnTranslate Redis database before enabling any public generation. A provider budget/alert may not be a hard cutoff. No public AI endpoint is activated by this PR.
