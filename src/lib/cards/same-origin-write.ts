/**
 * Accept browser writes only from the configured production origin or the
 * exact current Vercel deployment origin. Do not trust request Host or
 * X-Forwarded-Host to decide the allowed origin.
 */
export function allowSameOriginWrite(request: Request): boolean {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  if (!origin) return false;
  try {
    const actual = new URL(origin);
    if (actual.username || actual.password || actual.search || actual.hash || actual.pathname !== "/") return false;
    if (actual.protocol !== "https:" && !(actual.protocol === "http:" && actual.hostname === "localhost")) return false;
    const configured = new URL(process.env.NEXT_PUBLIC_APP_URL || "https://learntranslate.vercel.app");
    const allowed = new Set<string>();
    if (process.env.VERCEL_ENV !== "preview") allowed.add(configured.origin);
    // VERCEL_URL is the immutable deployment host; VERCEL_BRANCH_URL is the
    // stable branch alias used by the GitHub Preview link. Both are platform-provided.
    if (process.env.VERCEL_ENV === "preview") {
      for (const deployment of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) {
        if (deployment && /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.vercel\.app$/i.test(deployment))
          allowed.add("https://" + deployment.toLowerCase());
      }
    }
    return allowed.has(actual.origin);
  } catch { return false; }
}
