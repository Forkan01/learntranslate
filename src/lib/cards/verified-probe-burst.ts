/**
 * V1-G.7C.1: additional per-verified-account short-window admission.
 * This is a separate gate for the disabled-by-default quota probe, NOT
 * a public generation endpoint or an IP/device/bot detection system.
 */
export const ABUSE_BURST_LUA = [
  "local count = tonumber(redis.call('GET', KEYS[1]) or '0')",
  "if count >= tonumber(ARGV[1]) then return 0 end",
  "redis.call('INCR', KEYS[1])",
  "redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))",
  "return 1",
].join("\n");

export async function reserveVerifiedProbeBurst(actorId: string): Promise<"allowed" | "limited" | "unavailable"> {
  if (!/^[a-f0-9]{64}$/.test(actorId)) return "unavailable";
  const endpoint = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!endpoint || !token) return "unavailable";
  let url: URL;
  try {
    url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return "unavailable";
  } catch { return "unavailable"; }
  const bucket = Math.floor(Date.now() / 10000);
  const args = ["EVAL", ABUSE_BURST_LUA, "1", "lt:probe:burst:" + actorId + ":" + bucket, "1", "20"];
  try {
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) return "unavailable";
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("result" in data)) return "unavailable";
    const result = (data as { result: unknown }).result;
    return result === 1 ? "allowed" : result === 0 ? "limited" : "unavailable";
  } catch { return "unavailable"; }
}
