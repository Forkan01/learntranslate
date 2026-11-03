/**
 * V1-G.4: global and trusted-private-actor admission gate for AI generation.
 * Atomic Redis EVAL prevents parallel requests bypassing limits.
 * Every admitted attempt consumes a slot, even if the provider fails.
 * This is a request ceiling, NOT a monetary spending cap.
 */
const LUA = [
  "local day = tonumber(redis.call('GET', KEYS[1]) or '0')",
  "local minute = tonumber(redis.call('GET', KEYS[2]) or '0')",
  "if day >= tonumber(ARGV[1]) then return 0 end",
  "if minute >= tonumber(ARGV[2]) then return 0 end",
  "local actorDay = tonumber(redis.call('GET', KEYS[3]) or '0')",
  "local actorMinute = tonumber(redis.call('GET', KEYS[4]) or '0')",
  "if actorDay >= tonumber(ARGV[4]) then return 0 end",
  "if actorMinute >= tonumber(ARGV[5]) then return 0 end",
  "redis.call('INCR', KEYS[1])",
  "redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))",
  "redis.call('INCR', KEYS[2])",
  "redis.call('EXPIRE', KEYS[2], 120)",
  "redis.call('INCR', KEYS[3])",
  "redis.call('EXPIRE', KEYS[3], tonumber(ARGV[3]))",
  "redis.call('INCR', KEYS[4])",
  "redis.call('EXPIRE', KEYS[4], 120)",
  "return 1",
].join("\n");

export async function reserveGenerationAttempt(actorId: string): Promise<"allowed" | "limited" | "unavailable"> {
  // The caller must authenticate the actor server-side; never trust a browser-provided ID.
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(actorId)) return "unavailable";
  const endpoint = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  // A missing or invalid durable store must NEVER fall back to in-memory counters.
  if (!endpoint || !token) return "unavailable";
  let url: URL;
  try {
    url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return "unavailable";
  } catch { return "unavailable"; }
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const minute = now.toISOString().slice(0, 16);
  const remainingDaySeconds = 86400 - (now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds()) + 120;
  // Both global and actor ceilings are checked and incremented atomically.
  const args = ["EVAL", LUA, "4", "lt:ai:global:day:" + day,
    "lt:ai:global:minute:" + minute,
    "lt:ai:actor:" + actorId + ":day:" + day,
    "lt:ai:actor:" + actorId + ":minute:" + minute,
    "10", "2", String(remainingDaySeconds), "3", "1"];
  try {
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) return "unavailable";
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("result" in payload)) return "unavailable";
    const result = (payload as { result: unknown }).result;
    return result === 1 ? "allowed" : result === 0 ? "limited" : "unavailable";
  } catch { return "unavailable"; }
}
