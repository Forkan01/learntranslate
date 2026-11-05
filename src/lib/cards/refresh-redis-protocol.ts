/**
 * Redis Lua scripts for lease ownership. Callers must validate the Upstash
 * response and fail closed on any network error; these scripts are not wired
 * into the auth route until integration tests are complete.
 */
export const REFRESH_LEASE_TTL_MS = 8000;
export const REFRESH_HANDOFF_TTL_MS = 15000;
export const REFRESH_PUBLISH_LUA = [
  "if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end",
  "redis.call('SET', KEYS[2], ARGV[2], 'PX', ARGV[3])",
  "redis.call('DEL', KEYS[1])",
  "return 1",
].join("\n");
export const REFRESH_RELEASE_LUA = [
  "if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end",
  "redis.call('DEL', KEYS[1])",
  "return 1",
].join("\n");
export function refreshRedisKeys(id: string): { lease: string; handoff: string } | null {
  if (!/^[a-f0-9]{64}$/.test(id)) return null;
  const prefix = "lt:auth:refresh:v1:" + id;
  return { lease: prefix + ":lease", handoff: prefix + ":handoff" };
}
