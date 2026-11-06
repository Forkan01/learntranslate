/**
 * Serialize session-cookie-changing requests in this tab and, where supported,
 * across same-origin tabs via the Web Locks API. This does not coordinate
 * server instances or protect against requests outside this helper.
 */
let tail: Promise<void> = Promise.resolve();
const LOCK_NAME = "lt:auth:session-cookie-operations:v1";

export function serializeSessionRequest<T>(request: () => Promise<T>): Promise<T> {
  const execute = () => {
    const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
    if (locks && typeof locks.request === "function") {
      // Do not silently bypass a rejected lock acquisition.
      return locks.request(LOCK_NAME, { mode: "exclusive" }, request);
    }
    // Browser fallback: tab-local serialization only.
    return request();
  };
  const current = tail.then(execute, execute);
  tail = current.then(() => undefined, () => undefined);
  return current;
}
