/** Cross-tab UI invalidation only. Never transport tokens or trust messages as auth. */
const CHANNEL = "lt:auth:session-notices:v1";
const SIGN_OUT = "signed-out";

export function announceSignOut(): void {
  if (typeof BroadcastChannel === "undefined") return;
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage(SIGN_OUT);
    channel.close();
  } catch { /* Other tabs will recheck when visible. */ }
}

export function subscribeSessionNotices(onSignOut: () => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = event => {
      if (event.data === SIGN_OUT) onSignOut();
    };
    return () => { channel.onmessage = null; channel.close(); };
  } catch { return () => {}; }
}
