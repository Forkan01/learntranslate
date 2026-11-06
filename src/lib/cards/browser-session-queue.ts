/**
 * Serialize requests initiated through this module within a browser tab.
 * Awaiting the entire fetch prevents a second request from starting before
 * the previous response's Set-Cookie headers have been processed.
 * This is NOT a cross-tab or cross-device lock.
 */
let tail: Promise<void> = Promise.resolve();

export function serializeSessionRequest<T>(request: () => Promise<T>): Promise<T> {
  const current = tail.then(request, request);
  tail = current.then(() => undefined, () => undefined);
  return current;
}
