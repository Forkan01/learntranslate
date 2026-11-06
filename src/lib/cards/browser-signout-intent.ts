/** Browser-only UI race marker. Not an authentication or authorization control. */
const KEY = "lt:auth:signout-intent:v1";
export function signOutMarker(): string | null {
  try { return window.localStorage.getItem(KEY); } catch { return null; }
}
export function markSignOutIntent(): void {
  try {
    window.localStorage.setItem(KEY, crypto.randomUUID());
  } catch { /* Storage may be blocked; server still controls authentication. */ }
}
export function callbackIsStale(initial: string | null): boolean {
  return signOutMarker() !== initial;
}
