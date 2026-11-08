"use client";

import { useEffect, useRef, useState } from "react";
import { captureMagicLinkRedirect } from "@/lib/cards/magic-link-callback.mjs";
import Link from "next/link";
import { callbackIsStale, signOutMarker } from "@/lib/cards/browser-signout-intent";
import { serializeSessionRequest } from "@/lib/cards/browser-session-queue";

/**
 * Supabase's default email link redirects with tokens in the URL fragment.
 * Verify the access token with Auth before displaying success; never persist it.
 * The server creates an HttpOnly session after verifying the token pair.
 */
export default function AuthCallbackPage() {
  const [status, setStatus] = useState("Verifying your email link…");
  const [sessionConfirmed, setSessionConfirmed] = useState(false);
  const captured = useRef<ReturnType<typeof captureMagicLinkRedirect> | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function verify() {
      const initialSignOutMarker = signOutMarker();
      // Capture into component memory BEFORE removing the sensitive fragment.
      // React StrictMode replays this effect in development; the second setup
      // reuses the captured values rather than seeing an already-cleared URL.
      const redirect = captureMagicLinkRedirect(window.location.hash, captured.current);
      captured.current = redirect;
      window.history.replaceState(null, "", "/auth/callback");
      async function confirmBrowserSession(): Promise<boolean> {
        const check = await serializeSessionRequest(() => {
          if (cancelled || callbackIsStale(initialSignOutMarker))
            throw new Error("Sign-in cancelled after sign-out");
          return fetch("/api/auth/session", {
            method: "GET", credentials: "same-origin", cache: "no-store",
          });
        });
        if (cancelled || !check.ok) return false;
        const proof: unknown = await check.json();
        return proof !== null && typeof proof === "object" &&
          !Array.isArray(proof) && "signedIn" in proof && proof.signedIn === true;
      }
      if (redirect.kind !== "credentials") {
        // Reloading an already-completed callback should not tell the user to
        // consume another one of their limited authentication emails.
        if (redirect.kind === "missing") {
          try {
            const existing = await confirmBrowserSession();
            if (cancelled) return;
            if (existing) {
              setSessionConfirmed(true);
              setStatus("✓ You're already signed in. Your browser session is confirmed.");
              return;
            }
          } catch { /* An uncertain session is not proof of authentication. */ }
        }
        if (!cancelled) setStatus(redirect.kind === "error"
          ? "The email link was rejected or expired. Check your existing session before requesting another link."
          : "No sign-in credentials were received. Check your session at /api/auth/session before requesting another email.");
        return;
      }
      const { accessToken: token, refreshToken: refresh, expires } = redirect;
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!base || !key) { setStatus("Authentication is not configured."); return; }
      try {
        const url = new URL(base);
        if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("Invalid Auth URL");
        const response = await fetch(url.origin + "/auth/v1/user", {
          headers: { apikey: key, Authorization: "Bearer " + token },
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        if (cancelled) return;
        if (!response.ok) throw new Error("Invalid token");
        const user: unknown = await response.json();
        if (!user || typeof user !== "object" || !("id" in user) ||
            typeof (user as { id: unknown }).id !== "string" ||
            (user as { is_anonymous?: boolean }).is_anonymous === true) throw new Error("Invalid user");
        const session = await serializeSessionRequest(() => {
          if (cancelled || callbackIsStale(initialSignOutMarker)) throw new Error("Sign-in cancelled after sign-out");
          return fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: token, refresh_token: refresh, expires_in: expires }),
          cache: "no-store",
          });
        });
        if (cancelled) return;
        if (!session.ok) {
          if (!cancelled) setStatus(session.status === 403
            ? "Sign-in could not finish: this deployment rejected the session request."
            : session.status === 401
              ? "Sign-in could not finish: the session credentials were rejected. Please request a fresh link."
              : "Sign-in could not finish: the session service returned an error. Please try again later.");
          return;
        }
        // Confirm that the browser retained the HttpOnly session. This
        // request sends NO email and does not expose session credentials.
        const confirmed = await confirmBrowserSession();
        if (cancelled) return;
        captured.current = null;
        if (!confirmed) {
          setStatus("Your email was verified, but the browser session could not be confirmed. Check /api/auth/session before requesting another email.");
          return;
        }
        setSessionConfirmed(true);
        setStatus("✓ Signed in successfully! Your browser session is confirmed.");
      } catch {
        if (!cancelled) {
          captured.current = null;
          setStatus("Verification or session confirmation was interrupted. Check /api/auth/session before requesting another email.");
        }
      }
    }
    void verify();
    return () => { cancelled = true; };
  }, []);
  return <main className="mx-auto max-w-lg px-5 py-16">
    <div className="rounded-3xl border border-[#d8d0bb] bg-[#fff9eb] p-8">
      <h1 className="text-2xl font-black text-[#293b37]">✉ LearnTranslate email verification</h1>
      <p role="status" className="mt-4 text-[#4d625d]">{status}</p>
      {sessionConfirmed && <Link href="/admin" className="mt-6 inline-block rounded-xl bg-[#668d84] px-5 py-3 font-bold text-white">Open Admin Dashboard →</Link>}
      <Link href="/search" className="ml-3 mt-6 inline-block rounded-xl border border-[#d8d0bb] px-5 py-3 font-bold">Back to Search</Link>
    </div>
  </main>;
}
