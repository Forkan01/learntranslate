"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";

type CardType = "word" | "sentence";
type SourceLanguage = "de" | "en";
type Example = { source: string; translation: string };
type AccessState = "checking" | "allowed" | "denied";
type PartOfSpeech = "noun" | "verb" | "adjective" | "adverb" | "pronoun" |
  "preposition" | "conjunction" | "interjection" | "article" | "particle" | "other";

const field = "mt-2 w-full rounded-xl border border-[#d8d4cb] bg-[#fbfaf7] px-3 py-3 text-sm text-[#343d4a] focus-visible:outline-2 focus-visible:outline-[#668d84]";
const label = "block text-sm font-bold";
const initialExamples = (): Example[] =>
  Array.from({ length: 5 }, () => ({ source: "", translation: "" }));

export default function NewAdminDraftPage() {
  const [access, setAccess] = useState<AccessState>("checking");
  const [type, setType] = useState<CardType>("word");
  const [sourceLanguage, setSourceLanguage] = useState<SourceLanguage>("de");
  const [term, setTerm] = useState("");
  const [translation, setTranslation] = useState("");
  const [partOfSpeech, setPartOfSpeech] = useState<PartOfSpeech>("other");
  const [article, setArticle] = useState("");
  const [plural, setPlural] = useState("");
  const [examples, setExamples] = useState<Example[]>(initialExamples);
  const [usageNotes, setUsageNotes] = useState("");
  const [naturalMeaning, setNaturalMeaning] = useState("");
  const [grammarBreakdown, setGrammarBreakdown] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [created, setCreated] = useState(false);
  const requestActive = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/admin/access", {
          cache: "no-store", credentials: "same-origin", signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (!response.ok) { setAccess("denied"); return; }
        const result: unknown = await response.json();
        if (!controller.signal.aborted)
          setAccess(result !== null && typeof result === "object" &&
            "authorized" in result && result.authorized === true ? "allowed" : "denied");
      } catch {
        if (!controller.signal.aborted) setAccess("denied");
      }
    })();
    return () => controller.abort();
  }, []);

  function editExample(index: number, key: keyof Example, value: string) {
    setExamples(current => current.map((example, i) => i === index
      ? { ...example, [key]: value } : example));
  }
  function lines(value: string) {
    return value.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestActive.current || created || access !== "allowed") return;
    requestActive.current = true;
    setSaving(true);
    setMessage("");
    try {
      const draft = type === "word"
        ? {
            type, sourceLanguage, term, translation,
            grammar: { partOfSpeech, article: partOfSpeech === "noun" ? article : "", plural },
            examples, usageNotes: lines(usageNotes),
          }
        : {
            type, sourceLanguage, term, translation,
            naturalMeaning, grammarBreakdown: lines(grammarBreakdown),
          };
      const response = await fetch("/api/admin/drafts", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (response.status === 201) {
        setCreated(true);
        setMessage("Draft created. Open the dashboard and select Status → Draft to find it.");
      } else if (response.status === 409) {
        setMessage("A card with this term already exists. No changes were made.");
      } else if (response.status === 404) {
        setMessage("Draft creation is disabled on this server. The separate write flag must be enabled.");
      } else if (response.status === 401 || response.status === 403) {
        setMessage("Your administrator session or request origin was rejected. No draft was created.");
      } else if (response.status === 400 || response.status === 415) {
        setMessage("Check your draft fields. The server rejected the card format.");
      } else {
        setMessage("Draft creation could not be confirmed. Check the Draft filter before trying again.");
      }
    } catch {
      setMessage("Connection interrupted. Check the Draft filter before trying again to avoid duplicates.");
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
          <h1 className="mt-7 text-3xl font-black tracking-tight">Create a learning card</h1>
          <p className="mt-2 text-sm text-[#64717a]">
            Save a private draft. Drafts are not searchable by students and cannot be published here.
            You can fill incomplete fields now and refine them in a later editing milestone.
          </p>

          {access === "checking" && <p role="status" className="mt-6">Verifying administrator access…</p>}
          {access === "denied" && (
            <p role="alert" className="mt-6 rounded-2xl bg-[#fff0d5] p-4">
              Administrator access is not confirmed. Sign in and return to this page.
            </p>
          )}
          {access === "allowed" && (
            <form className="mt-7 space-y-6" onSubmit={submit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={label}>Card type
                  <select className={field} value={type} onChange={event => setType(event.target.value as CardType)}>
                    <option value="word">Word Card</option>
                    <option value="sentence">Sentence Card</option>
                  </select>
                </label>
                <label className={label}>Original language
                  <select className={field} value={sourceLanguage}
                    onChange={event => setSourceLanguage(event.target.value as SourceLanguage)}>
                    <option value="de">German → English</option>
                    <option value="en">English → German</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={label}>Word or sentence *
                  <input className={field} required maxLength={500} value={term}
                    onChange={event => setTerm(event.target.value)} placeholder="e.g. die Entscheidung" />
                </label>
                <label className={label}>Translation
                  <input className={field} maxLength={500} value={translation}
                    onChange={event => setTranslation(event.target.value)} placeholder="e.g. decision" />
                </label>
              </div>
              {type === "word" ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className={label}>Part of speech
                      <select className={field} value={partOfSpeech}
                        onChange={event => setPartOfSpeech(event.target.value as PartOfSpeech)}>
                        {(["other", "noun", "verb", "adjective", "adverb", "pronoun",
                          "preposition", "conjunction", "interjection", "article", "particle"] as const)
                          .map(part => <option key={part} value={part}>{part}</option>)}
                      </select>
                    </label>
                    <label className={label}>Article
                      <select className={field} disabled={partOfSpeech !== "noun"} value={partOfSpeech === "noun" ? article : ""}
                        onChange={event => setArticle(event.target.value)}>
                        <option value="">Not specified</option>
                        <option value="der">der</option><option value="die">die</option><option value="das">das</option>
                      </select>
                    </label>
                    <label className={label}>Plural / form
                      <input className={field} maxLength={150} value={plural}
                        onChange={event => setPlural(event.target.value)} placeholder="Optional in draft" />
                    </label>
                  </div>
                  <section className="rounded-2xl border border-[#e0dfd6] bg-[#fbfaf7] p-4">
                    <h2 className="font-black">Five bilingual examples</h2>
                    <p className="mt-1 text-xs text-[#64717a]">Leave examples blank if you are still preparing this draft.</p>
                    <div className="mt-4 space-y-4">
                      {examples.map((example, index) => (
                        <div key={index} className="grid gap-3 sm:grid-cols-2">
                          <label className={label}>Example {index + 1} · {sourceLanguage.toUpperCase()}
                            <input className={field} maxLength={600} value={example.source}
                              onChange={event => editExample(index, "source", event.target.value)} />
                          </label>
                          <label className={label}>Translation {index + 1}
                            <input className={field} maxLength={600} value={example.translation}
                              onChange={event => editExample(index, "translation", event.target.value)} />
                          </label>
                        </div>
                      ))}
                    </div>
                  </section>
                  <label className={label}>Usage notes (one per line)
                    <textarea className={field} rows={3} maxLength={4700} value={usageNotes}
                      onChange={event => setUsageNotes(event.target.value)} />
                  </label>
                </>
              ) : (
                <>
                  <label className={label}>Natural meaning / when to use this sentence
                    <textarea className={field} rows={3} maxLength={1000} value={naturalMeaning}
                      onChange={event => setNaturalMeaning(event.target.value)} />
                  </label>
                  <label className={label}>Grammar breakdown (one note per line)
                    <textarea className={field} rows={4} maxLength={4700} value={grammarBreakdown}
                      onChange={event => setGrammarBreakdown(event.target.value)} />
                  </label>
                </>
              )}
              {message && <p role="status" className="rounded-2xl bg-[#edf4f0] p-4 text-sm">{message}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={saving || created || !term.trim()}
                  className="rounded-2xl bg-[#668d84] px-6 py-3 text-sm font-black text-white disabled:opacity-50">
                  {saving ? "Saving…" : created ? "Draft saved" : "Save private draft"}
                </button>
                <Link href="/admin" className="rounded-2xl border px-5 py-3 text-sm font-bold">View cards</Link>
              </div>
              <p className="text-xs text-[#768078]">No AI calls. No public publishing. Category assignment and editing will follow in later milestones.</p>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
