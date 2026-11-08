"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { callbackIsStale, signOutMarker } from "@/lib/cards/browser-signout-intent";
import { serializeSessionRequest } from "@/lib/cards/browser-session-queue";
import { parseEmailOtpSession, validEmailOtp, validOtpEmail } from "@/lib/cards/email-otp-credentials.mjs";

type Phase = "email" | "sending" | "code" | "verifying" | "complete";
const noStore = { cache: "no-store" as const };

function authConfig(): { origin: string; key: string } | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) return null;
  try {
    const url = new URL(base);
    if (url.protocol !== "https:" || url.username || url.password ||
        url.search || url.hash || url.pathname !== "/") return null;
    return { origin: url.origin, key };
  } catch {
    return null;
  }
}

/**
 * Passwordless email code sign-in. No link redirects and no auth credentials
 * in the URL, localStorage or sessionStorage. No new user accounts created.
 * The existing same-origin HttpOnly session endpoint handles session cookies.
 */
export default function EmailCodeSignInPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [phase, setPhase] = useState<Phase>("email");
  const [message, setMessage] = useState("");

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phase !== "email" || !validOtpEmail(email.trim())) {
      setMessage("Enter a valid email address.");
      return;
    }
    const config = authConfig();
    if (!config) { setMessage("Supabase sign-in is not configured."); return; }
    setPhase("sending");
    setMessage("");
    try {
      const response = await fetch(config.origin + "/auth/v1/otp", {
        method: "POST",
        headers: { apikey: config.key, "Content-Type": "application/json" },
        // Existing users only; administrator sign-in must never create a new user.
        body: JSON.stringify({ email: email.trim(), create_user: false }),
        ...noStore,
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        setPhase("email");
        setMessage(response.status === 429
          ? "Too many sign-in requests. Try again after the email rate limit resets."
          : "Could not send a sign-in code. Check the email address and try again later.");
        return;
      }
      setPhase("code");
      setMessage("Enter the six-digit code from your email. Do not click a sign-in link.");
    } catch {
      setPhase("email");
      setMessage("Unable to contact Supabase Auth. Check your connection and try again.");
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phase !== "code") return;
    if (!validOtpEmail(email.trim()) || !validEmailOtp(otp)) {
      setMessage("Enter the six-digit code from your email.");
      return;
    }
    const config = authConfig();
    if (!config) { setMessage("Supabase sign-in is not configured."); return; }
    const marker = signOutMarker();
    setPhase("verifying");
    setMessage("");
    try {
      const response = await fetch(config.origin + "/auth/v1/verify", {
        method: "POST",
        headers: { apikey: config.key, "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), token: otp, type: "email" }),
        ...noStore,
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        setOtp("");
        setPhase("code");
        setMessage(response.status === 429
          ? "Too many attempts. Try again later."
          : "That code was invalid or has expired. Check your email or request a new code.");
        return;
      }
      const responseBody: unknown = await response.json();
      const tokens = parseEmailOtpSession(responseBody);
      if (!tokens) throw new Error("Invalid verification response");

      // Serialize against sign-out and verify the one-time pair server-side.
      const saved = await serializeSessionRequest(() => {
        if (callbackIsStale(marker)) throw new Error("Sign-in was cancelled");
        return fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tokens),
          credentials: "same-origin",
          ...noStore,
        });
      });
      if (!saved.ok) {
        setPhase("code");
        setOtp("");
        setMessage(saved.status === 403
          ? "Your local app origin was rejected. Check NEXT_PUBLIC_APP_URL and restart the dev server, then request a fresh code."
          : "Email verified, but the browser session could not be established. Request a fresh code and retry.");
        return;
      }

      // Do not claim success until a subsequent browser request can read
      // the HttpOnly session that the server just established.
      const confirmed = await serializeSessionRequest(() =>
        fetch("/api/auth/session", { credentials: "same-origin", ...noStore }));
      const payload: unknown = await confirmed.json();
      const signedIn = confirmed.ok && payload !== null &&
        typeof payload === "object" && !Array.isArray(payload) &&
        "signedIn" in payload && payload.signedIn === true;
      if (!signedIn) throw new Error("Session confirmation failed");

      setOtp("");
      setPhase("complete");
      setMessage("Signed in successfully. Your account can now be checked for administrator access.");
    } catch {
      setOtp("");
      setPhase("code");
      setMessage("Sign-in could not be completed or confirmed. Request a fresh code and try again.");
    }
  }

  return (
    <main className="min-h-screen bg-[#fffaf2] px-5 py-14 text-[#343d4a]">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="text-sm font-black text-[#4f6c77]">← LearnTranslate</Link>
        <section className="mt-8 rounded-[30px] border-2 border-[#d9d4c9] bg-white p-6 shadow-[6px_7px_0_#e8e1d6] sm:p-9">
          <span className="rounded-full bg-[#e6f2ec] px-4 py-2 text-xs font-black uppercase tracking-wider">✉ Secure sign-in</span>
          <h1 className="mt-6 text-3xl font-black tracking-tight">Sign in with an email code</h1>
          <p className="mt-3 text-sm text-[#64717a]">Use the email address already registered with LearnTranslate. Your code stays on this page—no magic link or browser redirect needed.</p>

          {(phase === "email" || phase === "sending") && (
            <form onSubmit={requestCode} className="mt-6 space-y-3">
              <label htmlFor="lt-code-email" className="block text-sm font-bold">Email address</label>
              <input id="lt-code-email" type="email" autoComplete="email" value={email}
                onChange={event => setEmail(event.target.value)} maxLength={254} required
                placeholder="you@example.com" className="w-full rounded-xl border border-[#d8d4cb] bg-[#f4f8f5] p-3" />
              <button type="submit" disabled={phase === "sending"}
                className="w-full rounded-xl bg-[#668d84] px-5 py-3 font-bold text-white disabled:opacity-50">
                {phase === "sending" ? "Sending…" : "Send six-digit code"}
              </button>
            </form>
          )}
          {(phase === "code" || phase === "verifying") && (
            <form onSubmit={verifyCode} className="mt-6 space-y-3">
              <p className="break-words text-sm">Code sent to <strong>{email.trim()}</strong></p>
              <label htmlFor="lt-email-otp" className="block text-sm font-bold">Six-digit code</label>
              <input id="lt-email-otp" type="text" inputMode="numeric" pattern="[0-9]{6}"
                autoComplete="one-time-code" value={otp}
                onChange={event => setOtp(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                maxLength={6} required
                className="w-full rounded-xl border border-[#d8d4cb] bg-[#f4f8f5] p-3 text-center text-2xl tracking-widest" />
              <button type="submit" disabled={phase === "verifying"}
                className="w-full rounded-xl bg-[#668d84] px-5 py-3 font-bold text-white disabled:opacity-50">
                {phase === "verifying" ? "Verifying…" : "Verify code and sign in"}
              </button>
              <button type="button" disabled={phase === "verifying"}
                onClick={() => { setOtp(""); setMessage(""); setPhase("email"); }}
                className="w-full rounded-xl border border-[#d8d4cb] px-5 py-3 text-sm font-bold disabled:opacity-50">
                Request a new code
              </button>
            </form>
          )}
          {phase === "complete" && (
            <div className="mt-6 rounded-2xl bg-[#e4f0e9] p-4">
              <p className="font-bold">✓ Your session is confirmed.</p>
              <Link href="/admin" className="mt-4 inline-block rounded-xl bg-[#668d84] px-5 py-3 text-sm font-bold text-white">
                Open Admin Dashboard →
              </Link>
            </div>
          )}
          {message && <p role="status" className="mt-4 text-sm text-[#594621]">{message}</p>}
          <p className="mt-5 text-xs text-[#77756e]">
            If your email contains only a link, configure the Supabase Magic Link email template to include the OTP token. Do not share the code or sign-in URL.
          </p>
        </section>
      </div>
    </main>
  );
}
