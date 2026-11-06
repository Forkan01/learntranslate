/**
 * Serialize session GET and DELETE requests within one browser tab.
 * Fetch responses may set HttpOnly cookies before JS observes them;
 * an AbortController alone cannot prevent a stale Set-Cookie response.
 * This queue avoids overlapping auth requests issued through this module.
 * It does NOT coordinate other tabs or independent API callers.
 */
let tail: Promise<void> = Promise.resolve();

export function queueSessionRequest<T>(operation: () => Promise<T>): Promise<T> {
  const next = tail.then(operation);
  tail = next.then(() => undefined, () => undefined);
  return next;
}

export function checkBrowserSession(signal?: AbortSignal): Promise<Response> {
  return queueSessionRequest(() => {
    if (signal?.aborted) throw new DOMException("Session check canceled", "AbortError");
    return fetch("/api/auth/session", { cache: "no-store", signal });
  });
}

export function signOutBrowserSession(): Promise<Response> {
  return queueSessionRequest(() => fetch("/api/auth/session", { method: "DELETE", cache: "no-store" }));
}
