# LT-05 Gemini provider setup

LearnTranslate uses an offline provider when no Gemini API key is configured. The offline provider supports only the sample phrases.

To enable Gemini on a deployed server, configure the server-only environment variable `GEMINI_API_KEY` in your deployment provider's secret settings. Optionally set `GEMINI_MODEL` to a supported model ID (default: `gemini-2.5-flash`). Never put keys in `NEXT_PUBLIC_*` variables or commit them to Git.

The server sends text to Gemini for translation, so users should not enter secrets or sensitive personal information. Translation requests are limited to 2,000 characters. Gemini calls time out after 12 seconds. If Gemini is unavailable, the offline provider handles supported phrases; otherwise the API returns HTTP 503.

Before public deployment, add authentication or per-user rate limiting, usage quotas and cost alerts to prevent abuse and unexpected charges. CI does not need a Gemini key. This milestone does not include a live provider test.
