"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { parseBulkDraftRequest } from "@/lib/admin/bulk-drafts.mjs";

type Access = "checking" | "allowed" | "denied";
type CardType = "word" | "sentence";
type Language = "de" | "en";

const field = "mt-2 w-full rounded-xl border border-[#d8d4cb] bg-[#fbfaf7] px-3 py-3 text-sm text-[#343d4a] focus-visible:outline-2 focus-visible:outline-[#668d84]";
const label = "block text-sm font-bold";

export default function BulkAdminDraftPage() {
  const [access, setAccess] = useState<Access>("checking");
  const [type, setType] = useState<CardType>("word");
  const [sourceLanguage, setSourceLanguage] = useState<Language>("de");
  const [pairs, setPairs] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const requestActive = useRef(false);

  const parsed = useMemo(
    () => parseBulkDraftRequest({ type, sourceLanguage, pairs }),
    [type, sourceLanguage, pairs]
  );
  const lines = pairs.split(/\r?\n/).filter(line => line.trim()).length;

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/admin/access", {
          cache: "no-store", credentials: "same-origin", signal: controller.signal,
        });
        if (!response.ok) {
          if (!controller.signal.aborted) setAccess("denied");
          return;
        }
        const body: unknown = await response.json();
        if (!controller.signal.aborted) setAccess(body !== null &&
          typeof body === "object" && "authorized" in body &&
          body.authorized === true ? "allowed" : "denied");
      } catch {
        if (!controller.signal.aborted) setAccess("denied");
      }
    })();
    return () => controller.abort();
  }, []);

  function changePairs(value: string) {
    setPairs(value);
    setCreated(null);
    setMessage("");
  }
  async function importDrafts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parsed || !parsed.length || requestActive.current || access !== "allowed" || created !== null)
      return;
    requestActive.current = true;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/bulk-drafts", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, sourceLanguage, pairs }),
      });
      if (response.status === 201) {
        const result: { created?: number; status?: string } = await response.json();
        if (result.created === parsed.length && result.status === "draft") {
          setCreated(result.created);
          setMessage(result.created + " private drafts created. Nothing was published.");
        } else {
          setMessage("The import response was unexpected. Check your Drafts before attempting another import.");
        }
      } else if (response.status === 409) {
        setMessage("At least one of these cards already exists. Review your Drafts and remove existing terms before importing again.");
      } else if (response.status === 400) {
        setMessage("Invalid import format. Check tabs or ' | ' separators, languages, duplicates and the 20-card limit.");
      } else if (response.status === 404 || response.status === 503) {
        setMessage("Bulk import is disabled or unavailable. If the request timed out, inspect Drafts before retrying.");
      } else if (response.status === 401 || response.status === 403) {
        setMessage("Administrator authentication or origin verification failed.");
      } else {
        setMessage("Import could not be confirmed. Inspect Drafts before trying again.");
      }
    } catch {
      setMessage("Connection interrupted. Check Drafts to verify whether any cards were saved.");
    } finally {
      requestActive.current = false;
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fffaf2] px-4 py-10 text-[#343d4a] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/admin" className="text-sm font-black text-[#4f6c77]">← Back to card dashboard</Link>
        <section className="mt-7 rounded-[30px] border-2 border-[#d9d4c9] bg-white p-5 shadow-[6px_7px_0_#e8e1d6] sm:p-8">
          <span className="rounded-full bg-[#e6f2ec] px-4 py-2 text-xs font-black uppercase tracking-wider">✦ Private workspace</span>
          <h1 className="mt-6 text-3xl font-black tracking-tight">Bulk draft import</h1>
          <p className="mt-2 text-sm text-[#64717a]">
            Paste up to 20 German–English pairs. Every card is saved as an unpublished draft,
            ready for individual grammar and example editing before review.
          </p>

          {access === "checking" && <p role="status" className="mt-6">Verifying administrator access…</p>}
          {access === "denied" && <p role="alert" className="mt-6 rounded-2xl bg-[#fff0d5] p-4">
            This workspace requires a verified administrator session.
          </p>}
          {access === "allowed" && (
            <form onSubmit={importDrafts} className="mt-7 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={label}>Card type
                  <select className={field} value={type} disabled={saving || created !== null}
                    onChange={event => { setType(event.target.value as CardType); setCreated(null); setMessage(""); }}>
                    <option value="word">Word Cards</option>
                    <option value="sentence">Sentence Cards</option>
                  </select>
                </label>
                <label className={label}>Source language
                  <select className={field} value={sourceLanguage} disabled={saving || created !== null}
                    onChange={event => { setSourceLanguage(event.target.value as Language); setCreated(null); setMessage(""); }}>
                    <option value="de">German → English</option>
                    <option value="en">English → German</option>
                  </select>
                </label>
              </div>
              <label className={label}>Word or sentence pairs (one per line)
                <textarea className={field} rows={8} maxLength={16000}
                  disabled={saving || created !== null} value={pairs}
                  onChange={event => changePairs(event.target.value)}
                  placeholder={"der Bahnhof | train station\nverpassen | to miss\npünktlich | punctual"} />
              </label>
              <p className="text-xs text-[#64717a]">
                Separate each pair with <strong> | </strong> (space, pipe, space), or a tab
                when pasting from a spreadsheet. Both terms and translations are required.
                Blank lines are ignored.
              </p>

              {pairs.trim() && (
                <section className="rounded-2xl border border-[#d8d4cb] bg-[#fbfaf7] p-4">
                  <h2 className="text-sm font-black">Import preview</h2>
                  {!parsed ? (
                    <p role="alert" className="mt-2 text-sm text-[#925e37]">
                      Invalid batch ({lines} nonempty lines). Use 1–20 unique pairs,
                      each with exactly two nonempty fields separated by a tab or " | ".
                    </p>
                  ) : (
                    <>
                      <p className="mt-2 text-xs text-[#64717a]">{parsed.length} private {type} drafts will be created.</p>
                      <ol className="mt-3 max-h-72 list-inside list-decimal space-y-2 overflow-auto text-sm">
                        {parsed.map(row => (
                          <li key={row.search_key} className="break-words">
                            <span className="font-bold">{row.term}</span> — {String(row.content.translation)}
                          </li>
                        ))}
                      </ol>
                    </>
                  )}
                </section>
              )}

              <p className="rounded-2xl bg-[#edf4f0] p-4 text-xs">
                Word drafts start with five empty example slots and an unspecified part of speech.
                Sentence drafts start with an empty natural-meaning explanation. Complete these fields
                using Edit Draft before submitting them for review. No card is published automatically.
                Topic assignment will be added in the next step.
              </p>
              {message && <p role="status" className="rounded-2xl bg-[#edf4f0] p-4 text-sm">{message}</p>}
              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={saving || !parsed?.length || created !== null}
                  className="rounded-2xl bg-[#668d84] px-6 py-3 text-sm font-black text-white disabled:opacity-40">
                  {saving ? "Creating drafts…" : "Create " + (parsed?.length ?? 0) + " private drafts"}
                </button>
                <Link href="/admin" className="rounded-2xl border px-5 py-3 text-sm font-bold">Review imported drafts</Link>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
