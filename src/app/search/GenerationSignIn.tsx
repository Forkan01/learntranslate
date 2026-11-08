"use client";

import { useState, type FormEvent } from "react";

type AuthState = "idle" | "sending" | "sent" | "already-signed-in";

function authConfig(): { url: string; key: string } | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) return null;
  try {
    const url = new URL(base);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    return { url: url.origin, key };
  } catch { return null; }
}

/**
 * Lightweight passwordless sign-in for future AI access.
 * Access tokens are held in component memory only, never persisted or logged.
 * This UI does NOT unlock AI generation.
 */
export default function GenerationSignIn() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<AuthState>("idle");
  const [message, setMessage] = useState("");
  async function sendLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state !== "idle") return;
    const config = authConfig();
    if (!config) { setMessage("Sign-in is not configured yet."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      setMessage("Enter a valid email address."); return;
    }
    setState("sending"); setMessage("");
    try {
      // Use the existing (no-email) session endpoint first. A previous login
      // may already have succeeded even when the callback displayed an error.
      // Fail closed on an uncertain session instead of wasting an email.
      const session = await fetch("/api/auth/session", {
        method: "GET", credentials: "same-origin", cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (!session.ok) {
        setState("idle");
        setMessage("Could not confirm your current session. No email was sent; please check /api/auth/session before retrying.");
        return;
      }
      const payload: unknown = await session.json();
      if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
          !("signedIn" in payload) || typeof payload.signedIn !== "boolean") {
        setState("idle");
        setMessage("The session check was inconclusive. No email was sent.");
        return;
      }
      if (payload.signedIn) {
        setState("already-signed-in");
        setMessage("You are already signed in. No new email was needed.");
        return;
      }
      const authUrl = new URL(config.url + "/auth/v1/otp");
      authUrl.searchParams.set("redirect_to", window.location.origin + "/auth/callback");
      const response = await fetch(authUrl.toString(), {
        method: "POST", headers: { apikey: config.key, "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), create_user: true }),
        cache: "no-store",
      });
      if (!response.ok) {
        setState("idle");
        if (response.status === 429) setMessage("Too many sign-in requests. Please wait before requesting another link.");
        else if (response.status === 400 || response.status === 422) setMessage("The sign-in request was rejected. Check your email address or try again later.");
        else if (response.status >= 500) setMessage("The email service is temporarily unavailable. Please try again later.");
        else setMessage("Could not send the sign-in link. Please try again later.");
        return;
      }
      setState("sent");
      setMessage("Check your email and open the confirmation link. The link will return you to LearnTranslate.");
    } catch { setState("idle"); setMessage("Could not contact the email service. Check your connection and try again later."); }
  }
  return <div className="mt-4 rounded-2xl border border-[#ddcfb5] bg-white p-4">
    <h3 className="font-black">✉ Sign in for future AI access</h3>
    <p className="mt-1 text-sm text-[#645e55]">Searching and browsing vocabulary remain free without an account.</p>
    {state === "already-signed-in" ? <p className="mt-3 text-sm font-semibold">✓ Already signed in. Open <a className="underline" href="/admin">the admin dashboard</a> to verify access.</p> :
      state === "sent" ? <p className="mt-3 text-sm font-semibold">✉ Email sent. Open the confirmation link in your inbox once.</p> :
      <form onSubmit={sendLink} className="mt-3 flex flex-wrap gap-2">
        <label className="w-full text-sm font-semibold" htmlFor="lt-signin-email">Email address</label>
        <input id="lt-signin-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} autoComplete="email" className="min-w-0 flex-1 rounded-xl border p-3" placeholder="you@example.com" required />
        <button type="submit" disabled={state === "sending"} className="rounded-xl bg-[#668d84] px-4 py-3 font-bold text-white disabled:opacity-50">Send sign-in link</button>
      </form>}
    {message && <p role="status" className="mt-3 text-sm text-[#6c6050]">{message}</p>}
    <p className="mt-3 text-xs text-[#77756e]">Magic links can be used only once. Check your browser session before requesting another email. Public AI generation remains disabled.</p>
  </div>;
}
