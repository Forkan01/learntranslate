"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Example = { source: string; translation: string };
type PartOfSpeech = "noun" | "verb" | "adjective" | "adverb" | "pronoun" |
  "preposition" | "conjunction" | "interjection" | "article" | "particle" | "other";
type Draft = {
  id: string;
  type: "word" | "sentence";
  status: "draft";
  sourceLanguage: "de" | "en";
  targetLanguage: "de" | "en";
  term: string;
  updatedAt: string;
  content: {
    translation: string;
    grammar?: { partOfSpeech?: string; article?: string; plural?: string };
    examples?: Example[];
    usageNotes?: string[];
    naturalMeaning?: string;
    grammarBreakdown?: string[];
  };
};
const input = "mt-2 w-full rounded-xl border border-[#d8d4cb] bg-[#fbfaf7] px-3 py-3 text-sm text-[#343d4a] focus-visible:outline-2 focus-visible:outline-[#668d84]";
const label = "block text-sm font-bold";
const emptyExample = (): Example => ({ source: "", translation: "" });
const splitNotes = (value: string) => value.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
const validPart = (value: unknown): PartOfSpeech =>
  typeof value === "string" && (["noun", "verb", "adjective", "adverb",
    "pronoun", "preposition", "conjunction", "interjection", "article", "particle", "other"] as string[]).includes(value)
    ? value as PartOfSpeech : "other";

export default function EditAdminDraftPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [translation, setTranslation] = useState("");
  const [partOfSpeech, setPartOfSpeech] = useState<PartOfSpeech>("other");
  const [article, setArticle] = useState("");
  const [plural, setPlural] = useState("");
  const [examples, setExamples] = useState<Example[]>(Array.from({length:5}, emptyExample));
  const [usageNotes, setUsageNotes] = useState("");
  const [naturalMeaning, setNaturalMeaning] = useState("");
  const [grammarBreakdown, setGrammarBreakdown] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const savingRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/admin/drafts/" + encodeURIComponent(id), {
          cache: "no-store", credentials: "same-origin", signal: controller.signal,
        });
        if (!response.ok) throw new Error("Unavailable");
        const raw: { draft?: Draft } = await response.json();
        const found = raw.draft;
        if (!found || found.id !== id || found.status !== "draft" ||
            !["word", "sentence"].includes(found.type)) throw new Error("Invalid draft");
        if (controller.signal.aborted) return;
        setDraft(found);
        setTranslation(found.content.translation || "");
        setPartOfSpeech(validPart(found.content.grammar?.partOfSpeech));
        setArticle(found.content.grammar?.article || "");
        setPlural(found.content.grammar?.plural || "");
        setExamples(Array.from({length:5}, (_, index) =>
          found.content.examples?.[index] || emptyExample()));
        setUsageNotes((found.content.usageNotes || []).join("\n"));
        setNaturalMeaning(found.content.naturalMeaning || "");
        setGrammarBreakdown((found.content.grammarBreakdown || []).join("\n"));
        setLoadState("ready");
      } catch {
        if (!controller.signal.aborted) setLoadState("unavailable");
      }
    })();
    return () => controller.abort();
  }, [id]);

  function editExample(index: number, key: keyof Example, value: string) {
    setExamples(items => items.map((item, i) => i === index
      ? { ...item, [key]: value } : item));
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setMessage("");
    const fields = draft.type === "word"
      ? {
          translation,
          grammar: { partOfSpeech, article: partOfSpeech === "noun" ? article : "", plural },
          examples,
          usageNotes: splitNotes(usageNotes),
        }
      : {
          translation, naturalMeaning, grammarBreakdown: splitNotes(grammarBreakdown),
        };
    try {
      const response = await fetch("/api/admin/drafts/" + encodeURIComponent(draft.id), {
        method: "PATCH", cache: "no-store", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedUpdatedAt: draft.updatedAt, fields }),
      });
      if (response.ok) {
        const result: { draft?: { updatedAt?: string; status?: string } } = await response.json();
        if (result.draft?.status === "draft" && result.draft.updatedAt) {
          setDraft(previous => previous ? { ...previous, updatedAt: result.draft!.updatedAt! } : previous);
          setMessage("Draft changes saved privately. This card is still unpublished.");
        } else {
          setMessage("The save response was unexpected. Reload to check before saving again.");
        }
      } else if (response.status === 409) {
        setMessage("This draft changed elsewhere. Copy your changes if needed, then reload the editor.");
      } else if (response.status === 400 || response.status === 415) {
        setMessage("Some draft fields are invalid. Check grammar, examples, and note lengths.");
      } else if (response.status === 404) {
        setMessage("Draft not found or editing disabled on this server. Nothing was saved.");
      } else if (response.status === 401 || response.status === 403) {
        setMessage("Administrator authorization or request origin was rejected. Nothing was saved.");
      } else {
        setMessage("Save could not be confirmed. Reload before trying again to avoid overwriting changes.");
      }
    } catch {
      setMessage("Connection interrupted. Reload and verify the draft before saving again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fffaf2] px-4 py-10 text-[#343d4a] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/admin" className="text-sm font-black text-[#4f6c77]">← Back to card dashboard</Link>
        <section className="mt-7 rounded-[30px] border-2 border-[#d9d4c9] bg-white p-5 shadow-[6px_7px_0_#e8e1d6] sm:p-8">
          <span className="rounded-full bg-[#e6f2ec] px-4 py-2 text-xs font-black uppercase tracking-wider">✦ Private draft editor</span>
          <h1 className="mt-6 text-3xl font-black tracking-tight">Edit learning card</h1>
          {loadState === "loading" && <p role="status" className="mt-5">Loading private draft…</p>}
          {loadState === "unavailable" && (
            <p role="alert" className="mt-5 rounded-2xl bg-[#fff0d5] p-4">
              This draft cannot be opened. It may no longer be a draft, your session may need refreshing, or review access is disabled.
            </p>
          )}
          {loadState === "ready" && draft && (
            <>
              <div className="mt-4 rounded-2xl bg-[#edf4f0] p-4">
                <p className="break-words text-xl font-black">{draft.term}</p>
                <p className="mt-1 text-xs font-semibold">
                  {draft.type === "word" ? "Word Card" : "Sentence Card"} · {draft.sourceLanguage.toUpperCase()} → {draft.targetLanguage.toUpperCase()} · Private draft
                </p>
                <p className="mt-2 text-xs text-[#64717a]">Term, card type and language direction are locked in this milestone. Edits cannot publish this card.</p>
              </div>
              <form className="mt-6 space-y-6" onSubmit={save}>
                <label className={label}>Translation
                  <input className={input} maxLength={500} value={translation}
                    onChange={event => setTranslation(event.target.value)} />
                </label>
                {draft.type === "word" ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className={label}>Part of speech
                        <select className={input} value={partOfSpeech}
                          onChange={event => setPartOfSpeech(event.target.value as PartOfSpeech)}>
                          {(["other", "noun", "verb", "adjective", "adverb", "pronoun",
                            "preposition", "conjunction", "interjection", "article", "particle"] as const)
                            .map(item => <option value={item} key={item}>{item}</option>)}
                        </select>
                      </label>
                      <label className={label}>Article
                        <select className={input} disabled={partOfSpeech !== "noun"}
                          value={partOfSpeech === "noun" ? article : ""}
                          onChange={event => setArticle(event.target.value)}>
                          <option value="">Unspecified</option>
                          <option value="der">der</option><option value="die">die</option><option value="das">das</option>
                        </select>
                      </label>
                      <label className={label}>Plural / form
                        <input className={input} maxLength={150} value={plural}
                          onChange={event => setPlural(event.target.value)} />
                      </label>
                    </div>
                    <section className="rounded-2xl border border-[#e0dfd6] bg-[#fbfaf7] p-4">
                      <h2 className="font-black">Five bilingual examples</h2>
                      {examples.map((example, index) => (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2" key={index}>
                          <label className={label}>Example {index + 1}
                            <input className={input} maxLength={600} value={example.source}
                              onChange={event => editExample(index, "source", event.target.value)} />
                          </label>
                          <label className={label}>Translation {index + 1}
                            <input className={input} maxLength={600} value={example.translation}
                              onChange={event => editExample(index, "translation", event.target.value)} />
                          </label>
                        </div>
                      ))}
                    </section>
                    <label className={label}>Usage notes (one per line)
                      <textarea className={input} rows={4} maxLength={4700} value={usageNotes}
                        onChange={event => setUsageNotes(event.target.value)} />
                    </label>
                  </>
                ) : (
                  <>
                    <label className={label}>Natural meaning
                      <textarea className={input} rows={3} maxLength={1000} value={naturalMeaning}
                        onChange={event => setNaturalMeaning(event.target.value)} />
                    </label>
                    <label className={label}>Grammar notes (one per line)
                      <textarea className={input} rows={4} maxLength={4700} value={grammarBreakdown}
                        onChange={event => setGrammarBreakdown(event.target.value)} />
                    </label>
                  </>
                )}
                {message && <p role="status" className="rounded-2xl bg-[#edf4f0] p-4 text-sm">{message}</p>}
                <div className="flex flex-wrap items-center gap-3">
                  <button type="submit" disabled={saving}
                    className="rounded-2xl bg-[#668d84] px-6 py-3 text-sm font-black text-white disabled:opacity-50">
                    {saving ? "Saving…" : "Save draft changes"}
                  </button>
                  <Link href="/admin" className="rounded-2xl border px-5 py-3 text-sm font-bold">Back to dashboard</Link>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
