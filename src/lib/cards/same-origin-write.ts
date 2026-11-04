/**
 * Strict same-origin browser-write gate. Origin is mandatory; an absent or
 * malformed Sec-Fetch-Site is tolerated for older browsers, but an explicit
 * cross-site signal is rejected. Never use this as authentication.
 */
export function allowSameOriginWrite(request: Request): boolean {
  const origin = request.headers.get("origin");
  const expected = process.env.NEXT_PUBLIC_APP_URL || "https://learntranslate.vercel.app";
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  try {
    if (!origin) return false;
    const actual = new URL(origin);
    const configured = new URL(expected);
    return (actual.protocol === "https:" || (actual.protocol === "http:" && actual.hostname === "localhost")) &&
      actual.origin === configured.origin;
  } catch { return false; }
}
