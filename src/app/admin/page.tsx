"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type AccessState = "checking" | "authorized" | "sign-in" | "restricted" | "disabled" | "unavailable";

export default function AdminAccessPage() {
  const [state, setState] = useState<AccessState>("checking");

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/admin/access", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (response.ok) {
          const body: unknown = await response.json();
          if (!controller.signal.aborted) {
            setState(body && typeof body === "object" && "authorized" in body &&
              body.authorized === true ? "authorized" : "unavailable");
          }
        } else if (response.status === 401) setState("sign-in");
        else if (response.status === 403) setState("restricted");
        else if (response.status === 404) setState("disabled");
        else setState("unavailable");
      } catch {
        if (!controller.signal.aborted) setState("unavailable");
      }
    })();
    return () => controller.abort();
  }, []);

  const message: Record<AccessState, { heading: string; detail: string }> = {
    checking: {
      heading: "Checking access…",
      detail: "Verifying your LearnTranslate session.",
    },
    authorized: {
      heading: "Admin access verified",
      detail: "Your account passed the server-side administrator identity check. Card editing and publishing are not enabled yet.",
    },
    "sign-in": {
      heading: "Sign in required",
      detail: "Use your existing LearnTranslate account to sign in, then return here. A signed-in account must also be explicitly authorized by the server.",
    },
    restricted: {
      heading: "Access restricted",
      detail: "This account is not authorized to manage LearnTranslate cards.",
    },
    disabled: {
      heading: "Admin tools are not enabled",
      detail: "Administration remains off until the owner explicitly configures it.",
    },
    unavailable: {
      heading: "Access could not be verified",
      detail: "Please try again later. No administrator access has been granted.",
    },
  };

  return (
    <main className="min-h-screen bg-[#fffaf2] px-5 py-14 text-[#343d4a]">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="text-sm font-black text-[#4f6c77]">← LearnTranslate</Link>
        <section className="mt-8 rounded-[30px] border-2 border-[#d9d4c9] bg-white p-6 shadow-[6px_7px_0_#e8e1d6] sm:p-9">
          <span className="rounded-full bg-[#e6f2ec] px-4 py-2 text-xs font-black uppercase tracking-wider">✦ Administration</span>
          <h1 className="mt-6 text-3xl font-black tracking-tight">{message[state].heading}</h1>
          <p role="status" className="mt-4 leading-relaxed text-[#64717a]">{message[state].detail}</p>
          {state === "authorized" && (
            <div className="mt-6 rounded-2xl bg-[#fff0d5] p-4 text-sm">
              Next milestone: protected Word and Sentence Card editor, review queue and bulk import.
            </div>
          )}
          {state === "sign-in" && (
            <p className="mt-5 text-sm text-[#64717a]">
              The existing passwordless sign-in is available from the search page when a card is missing.
            </p>
          )}
          <div className="mt-7 flex gap-3">
            <Link href="/" className="rounded-2xl bg-[#668d84] px-5 py-3 text-sm font-bold text-white">Back to Search →</Link>
            <button type="button" onClick={() => window.location.reload()} className="rounded-2xl border border-[#d8d4cb] bg-white px-5 py-3 text-sm font-bold">Check again</button>
          </div>
        </section>
      </div>
    </main>
  );
}
