"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
// Only the publishable key is ever used in this client-side module.
const supabase: SupabaseClient | null = url && key ? createClient(url, key, {
  auth: { flowType: "pkce", autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
}) : null;

export default function AccountPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;
    client.auth.getUser().then(({ data, error }) => {
      if (active) {
        if (!error) setUser(data.user);
        setReady(true);
      }
    }).catch(() => { if (active) setReady(true); });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (active) { setUser(session?.user ?? null); setReady(true); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function sendLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || pending) return;
    setPending(true); setNotice("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin + "/auth/callback" }
      });
      setNotice(error ? error.message : "Check your email for a secure sign-in link. You can keep learning as a guest.");
    } catch { setNotice("Unable to send the sign-in email. Please try again."); }
    finally { setPending(false); }
  }

  async function signOut() {
    if (!supabase || pending) return;
    setPending(true); setNotice("");
    try {
      const { error } = await supabase.auth.signOut();
      setNotice(error ? error.message : "Signed out. Your local learning data is still on this device.");
    } catch { setNotice("Unable to sign out. Please try again."); }
    finally { setPending(false); }
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Account">
    <h2 className="text-lg font-bold">Your account</h2>
    <p className="mt-2 text-sm text-slate-600">An account is optional. All learning features work without signing in.</p>
    {!supabase ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Account sign-in is being configured. Continue learning as a guest.</p>
      : !ready ? <p className="mt-4 text-sm text-slate-500">Checking session…</p>
      : user ? <div className="mt-4 space-y-3">
          <p className="break-all text-sm">Signed in as <strong>{user.email ?? "your account"}</strong></p>
          <p className="text-xs text-slate-500">Your saved words and progress are still stored on this device. Cloud sync will be added later.</p>
          <button type="button" disabled={pending} onClick={signOut} className="rounded-xl border border-indigo-300 px-4 py-2 text-sm font-semibold text-indigo-700 disabled:opacity-50">Sign out</button>
        </div>
      : <form onSubmit={sendLink} className="mt-4 space-y-3">
          <label htmlFor="account-email" className="block text-sm font-semibold">Email address</label>
          <input id="account-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-slate-300 p-3 text-sm" />
          <button type="submit" disabled={pending} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Sending…" : "Email me a sign-in link"}</button>
          <p className="text-xs text-slate-500">A new account may be created when you sign in for the first time.</p>
        </form>}
    {notice && <p role="status" className="mt-3 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900">{notice}</p>}
  </section>;
}
