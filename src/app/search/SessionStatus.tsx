"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { serializeSessionRequest } from "@/lib/cards/browser-session-queue";
import { announceSignOut, subscribeSessionNotices } from "@/lib/cards/browser-session-notices";
import { interpretSessionResponse } from "@/lib/cards/session-recovery-state";

type SessionState = "loading" | "signed-in" | "signed-out" | "retryable";
export default function SessionStatus() {
  const [status, setStatus] = useState<SessionState>("loading");
  const [checking, setChecking] = useState(false);
  const requestEpoch = useRef(0);
  const signingOut = useRef(false);
  const checkSession = useCallback(async (signal?: AbortSignal) => {
    const epoch = ++requestEpoch.current;
    if (signingOut.current) return;
    try {
      const response = await serializeSessionRequest(() => fetch("/api/auth/session", { cache: "no-store", signal }));
      const data: unknown = await response.json();
      if (signal?.aborted || epoch !== requestEpoch.current || signingOut.current) return;
      setStatus(interpretSessionResponse(response.status, data));
    } catch {
      if (!signal?.aborted && epoch === requestEpoch.current && !signingOut.current) setStatus("retryable");
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    // Schedule the async check after effect setup; avoid synchronous state updates.
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) return checkSession(controller.signal);
    });
    const epochRef = requestEpoch;
    return () => {
      controller.abort();
      epochRef.current++;
    };
  }, [checkSession]);

  useEffect(() => {
    const epochRef = requestEpoch;
    const unsubscribe = subscribeSessionNotices(() => {
      // Never trust a cross-tab message as authentication evidence.
      // Invalidate older UI updates, then ask the server again.
      epochRef.current++;
      void checkSession();
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") void checkSession();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [checkSession]);

  if (status === "loading" || status === "signed-out") return null;
  if (status === "retryable") return <div role="status" className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[#fff1d6] p-3 text-sm text-[#594621]">
    <span>Session check temporarily unavailable. Your sign-in may still be valid.</span>
    <button type="button" disabled={checking} className="rounded-lg border border-[#ad9466] px-3 py-2 font-semibold disabled:opacity-50"
      onClick={async () => {
        setChecking(true);
        try { await checkSession(); } finally { setChecking(false); }
      }}>{checking ? "Checking…" : "Retry"}</button>
  </div>;
  return <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[#e4f0e9] p-3 text-sm text-[#28443b]">
    <span>✓ Signed in for future AI access</span>
    <button type="button" className="rounded-lg border border-[#668d84] px-3 py-2 font-semibold"
      onClick={async () => {
        if (signingOut.current) return;
        signingOut.current = true;
        requestEpoch.current++;
        try {
          const response = await serializeSessionRequest(() => fetch("/api/auth/session", { method: "DELETE" }));
          if (response.ok) {
            setStatus("signed-out");
            announceSignOut();
          }
        } catch { /* Do not claim sign-out without server confirmation. */ }
        finally {
          signingOut.current = false;
          // Reconcile any failed or uncertain sign-out against the server.
          void checkSession();
        }
      }}>Sign out</button>
  </div>;
}
