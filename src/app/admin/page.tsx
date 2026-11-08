"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type AccessState = "checking" | "authorized" | "sign-in" | "restricted" | "disabled" | "unavailable";
type FilterStatus = "all" | "draft" | "review" | "published" | "rejected";
type FilterType = "all" | "word" | "sentence";
type CardEntry = {
  id: string;
  type: "word" | "sentence";
  term: string;
  status: Exclude<FilterStatus, "all">;
  sourceLanguage: "de" | "en";
  targetLanguage: "de" | "en";
  updatedAt: string;
  content: {
    translation: string;
    naturalMeaning?: string;
    grammar?: { partOfSpeech?: string; article?: string; plural?: string };
    examples?: Array<{ source: string; translation: string }>;
    grammarBreakdown?: string[];
    usageNotes?: string[];
  };
};
type CardList = { cards: CardEntry[]; hasMore: boolean; offset: number };
type LoadingState = "loading" | "ready" | "unavailable";

const headings: Record<Exclude<AccessState, "authorized">, { title: string; detail: string }> = {
  checking: { title: "Checking access…", detail: "Verifying your LearnTranslate session." },
  "sign-in": {
    title: "Sign in required",
    detail: "Sign in to LearnTranslate, then return here. Regular signed-in accounts do not receive administrator privileges.",
  },
  restricted: { title: "Access restricted", detail: "This account cannot manage LearnTranslate cards." },
  disabled: { title: "Admin tools are disabled", detail: "An administrator must explicitly enable access on the server." },
  unavailable: { title: "Access could not be verified", detail: "Your session may have expired, or verification is temporarily unavailable." },
};

export default function AdminAccessPage() {
  const [state, setState] = useState<AccessState>("checking");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("review");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [offset, setOffset] = useState(0);
  const [loadState, setLoadState] = useState<LoadingState>("loading");
  const [cards, setCards] = useState<CardList | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [publishChecked, setPublishChecked] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const transitionActive = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/admin/access", {
          cache: "no-store", credentials: "same-origin", signal: controller.signal,
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

  useEffect(() => {
    if (state !== "authorized") return;
    const controller = new AbortController();
    void (async () => {
      // Defer updates until after effect setup; do not synchronously set React
      // state while an effect is executing.
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setLoadState("loading");
      setCards(null);
      setSelectedId(null);
      try {
        const params = new URLSearchParams({
          status: filterStatus, type: filterType, offset: String(offset),
        });
        const response = await fetch("/api/admin/cards?" + params.toString(), {
          cache: "no-store", credentials: "same-origin", signal: controller.signal,
        });
        if (!response.ok) throw new Error("List unavailable");
        const data: CardList = await response.json();
        if (!controller.signal.aborted) {
          setCards(data);
          setLoadState("ready");
        }
      } catch {
        if (!controller.signal.aborted) setLoadState("unavailable");
      }
    })();
    return () => controller.abort();
  }, [state, filterStatus, filterType, offset, reloadNonce]);

  async function transition(card: CardEntry, action: "submit" | "reject" | "revise" | "publish") {
    if (transitionActive.current || (action === "publish" && !publishChecked)) return;
    transitionActive.current = true;
    setTransitioning(true);
    setActionMessage("");
    const next = {submit:"review",reject:"rejected",revise:"draft",publish:"published"}[action];
    try {
      const response = await fetch("/api/admin/cards/" + encodeURIComponent(card.id) + "/review", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          action, expectedUpdatedAt: card.updatedAt, confirmed: action === "publish",
        }),
      });
      if (response.ok) {
        const raw: {card?: {id?:string;status?:string}} = await response.json();
        if (raw.card?.id === card.id && raw.card.status === next) {
          setActionMessage(action === "publish"
            ? "Card published. It is now available to public search."
            : "Card moved to " + next + ".");
          setPublishChecked(false);
          setSelectedId(null);
          setReloadNonce(n => n + 1);
        } else setActionMessage("Unexpected response. Refresh before attempting any other action.");
      } else if (response.status === 422) {
        setActionMessage("Card is incomplete. Return it to Draft and fill the missing translation, grammar or examples.");
      } else if (response.status === 409) {
        setActionMessage("Card changed in another session. Refresh before trying again.");
      } else if (response.status === 404 || response.status === 503) {
        setActionMessage("Review/publishing is disabled or unavailable on this server.");
      } else {
        setActionMessage("Action rejected. Check your administrator session and card status.");
      }
    } catch {
      setActionMessage("Outcome uncertain. Refresh the list before attempting another action.");
    } finally {
      transitionActive.current = false;
      setTransitioning(false);
    }
  }

  const selected = cards?.cards.find(card => card.id === selectedId);
  const badge = (status: string) => status === "published"
    ? "bg-[#e1f2e7] text-[#28543f]"
    : status === "review" ? "bg-[#fff0cd] text-[#78511e]"
      : "bg-[#e9ebf1] text-[#56616f]";

  return (
    <main className="min-h-screen bg-[#fffaf2] px-4 py-10 text-[#343d4a] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm font-black text-[#4f6c77]">← LearnTranslate</Link>
        <div className="mt-7 rounded-[30px] border-2 border-[#d9d4c9] bg-white p-5 shadow-[6px_7px_0_#e8e1d6] sm:p-8">
          <span className="rounded-full bg-[#e6f2ec] px-4 py-2 text-xs font-black uppercase tracking-wider">✦ Private workspace</span>
          {state !== "authorized" ? (
            <section className="mt-8">
              <h1 className="text-3xl font-black tracking-tight">{headings[state].title}</h1>
              <p role="status" className="mt-3 text-[#64717a]">{headings[state].detail}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/search" className="rounded-2xl bg-[#668d84] px-5 py-3 text-sm font-bold text-white">Go to Search</Link>
                <button type="button" onClick={() => window.location.reload()}
                  className="rounded-2xl border px-5 py-3 text-sm font-bold">Check again</button>
              </div>
            </section>
          ) : (
            <>
              <h1 className="mt-7 text-3xl font-black tracking-tight">Card review dashboard</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#64717a]">Browse and review private learning cards. Only a fully reviewed card can be published.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/admin/new" className="rounded-2xl bg-[#668d84] px-5 py-3 text-sm font-black text-white">+ Create private draft</Link>
              </div>
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-sm font-bold">Status
                  <select value={filterStatus} onChange={event => {
                    setFilterStatus(event.target.value as FilterStatus); setOffset(0);
                  }} className="mt-2 w-full rounded-xl border border-[#d8d4cb] bg-[#f4f8f5] p-3">
                    <option value="review">Awaiting review</option>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="rejected">Rejected</option>
                    <option value="all">All statuses</option>
                  </select>
                </label>
                <label className="text-sm font-bold">Card type
                  <select value={filterType} onChange={event => {
                    setFilterType(event.target.value as FilterType); setOffset(0);
                  }} className="mt-2 w-full rounded-xl border border-[#d8d4cb] bg-[#f4f8f5] p-3">
                    <option value="all">Word and Sentence</option>
                    <option value="word">Word Cards</option>
                    <option value="sentence">Sentence Cards</option>
                  </select>
                </label>
              </div>
              {actionMessage && <p role="status" className="mt-5 rounded-2xl bg-[#edf4f0] p-4 text-sm">{actionMessage}</p>}
              <section aria-label="Review cards" className="mt-7">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-black">Cards</h2>
                  <span className="text-xs font-semibold text-[#768078]">20 cards per page</span>
                </div>
                {loadState === "loading" && <p role="status" className="mt-4 rounded-2xl bg-[#f4f8f5] p-4">Loading cards…</p>}
                {loadState === "unavailable" && (
                  <p role="alert" className="mt-4 rounded-2xl bg-[#fff0d5] p-4 text-sm">
                    Review cards cannot be loaded. This requires a configured private admin database connection; no public access has been granted.
                  </p>
                )}
                {loadState === "ready" && cards?.cards.length === 0 && (
                  <p role="status" className="mt-4 rounded-2xl bg-[#edf4f0] p-4 text-sm">
                    No cards found for these filters.
                  </p>
                )}
                {loadState === "ready" && cards && (
                  <>
                    <div className="mt-4 grid gap-3">
                      {cards.cards.map(card => (
                        <button key={card.id} type="button" aria-pressed={selectedId === card.id}
                          onClick={() => { setSelectedId(current => current === card.id ? null : card.id); setPublishChecked(false); setActionMessage(""); }}
                          className="rounded-2xl border border-[#e0dfd6] bg-[#fbfaf7] p-4 text-left transition hover:border-[#8dafa4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#668d84]">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="min-w-0 break-words text-lg font-black">{card.term}</span>
                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${badge(card.status)}`}>{card.status}</span>
                          </div>
                          <p className="mt-1 break-words text-sm text-[#526572]">{card.content.translation}</p>
                          <p className="mt-2 text-xs font-semibold text-[#7e817a]">{card.type === "word" ? "Word" : "Sentence"} · {card.sourceLanguage.toUpperCase()} → {card.targetLanguage.toUpperCase()}</p>
                        </button>
                      ))}
                    </div>
                    <div className="mt-5 flex items-center justify-between gap-3">
                      <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}
                        className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-40">← Previous</button>
                      <span className="text-xs text-[#768078]">Page {Math.floor(offset / 20) + 1}</span>
                      <button type="button" disabled={!cards.hasMore} onClick={() => setOffset(offset + 20)}
                        className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-40">Next →</button>
                    </div>
                  </>
                )}
              </section>
              {selected && (
                <section aria-label="Selected card details" className="mt-7 rounded-[24px] border-2 border-dashed border-[#b9cec1] bg-[#f5faf5] p-5">
                  <h2 className="text-lg font-black">Card details · {selected.term}</h2>
                  <p className="mt-2 text-sm"><span className="font-bold">Translation:</span> {selected.content.translation}</p>
                  {selected.content.naturalMeaning && <p className="mt-2 text-sm"><span className="font-bold">Meaning:</span> {selected.content.naturalMeaning}</p>}
                  {selected.content.grammar?.partOfSpeech && (
                    <p className="mt-2 text-sm"><span className="font-bold">Grammar:</span> {selected.content.grammar.partOfSpeech}
                      {selected.content.grammar.article ? " · " + selected.content.grammar.article : ""}
                      {selected.content.grammar.plural ? " · plural: " + selected.content.grammar.plural : ""}
                    </p>
                  )}
                  {selected.content.examples?.length ? (
                    <div className="mt-3"><h3 className="text-sm font-black">Examples</h3>
                      <ol className="mt-2 list-inside list-decimal space-y-2 text-sm">
                        {selected.content.examples.map((ex, index) => (
                          <li key={index}>{ex.source} — {ex.translation}</li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                  {selected.content.grammarBreakdown?.length ? (
                    <div className="mt-3"><h3 className="text-sm font-black">Grammar notes</h3>
                      <ul className="mt-2 list-inside list-disc text-sm">
                        {selected.content.grammarBreakdown.map((note, index) => <li key={index}>{note}</li>)}
                      </ul>
                    </div>
                  ) : null}
                  {selected.content.usageNotes?.length ? (
                    <div className="mt-3"><h3 className="text-sm font-black">Usage notes</h3>
                      <ul className="mt-2 list-inside list-disc text-sm">
                        {selected.content.usageNotes.map((note,index) => <li key={index}>{note}</li>)}
                      </ul>
                    </div>
                  ) : null}
                  {selected.status === "review" && (
                    <details className="mt-4 rounded-xl border border-[#b9cec1] bg-white p-3">
                      <summary className="cursor-pointer text-sm font-black">Inspect every structured card field</summary>
                      <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(selected.content, null, 2)}</pre>
                    </details>
                  )}
                  {selected.status === "draft" && (
                    <Link href={"/admin/edit/" + selected.id}
                      className="mt-5 inline-block rounded-2xl bg-[#668d84] px-5 py-3 text-sm font-black text-white">
                      Edit private draft →
                    </Link>
                  )}
                  {selected.status === "draft" && (
                    <div className="mt-4"><button type="button" disabled={transitioning}
                      onClick={() => void transition(selected,"submit")}
                      className="rounded-xl bg-[#e5e6a4] px-4 py-3 text-sm font-black disabled:opacity-50">
                      Submit completed card for review →
                    </button></div>
                  )}
                  {selected.status === "review" && (
                    <div className="mt-5 space-y-3 rounded-2xl border border-[#abc5b8] bg-white p-4">
                      <p className="text-sm font-bold">Review the complete translation, grammar and examples before publishing.</p>
                      <label className="flex items-start gap-3 text-sm">
                        <input type="checkbox" checked={publishChecked} disabled={transitioning}
                          onChange={event => setPublishChecked(event.target.checked)}
                          className="mt-1" />
                        I personally checked that this card is accurate and suitable for learners.
                      </label>
                      <div className="flex flex-wrap gap-3">
                        <button type="button" disabled={transitioning || !publishChecked}
                          onClick={() => void transition(selected,"publish")}
                          className="rounded-xl bg-[#668d84] px-4 py-3 text-sm font-black text-white disabled:opacity-40">
                          Approve & Publish to public Search
                        </button>
                        <button type="button" disabled={transitioning}
                          onClick={() => void transition(selected,"reject")}
                          className="rounded-xl border border-[#d4b6a6] px-4 py-3 text-sm font-bold disabled:opacity-40">
                          Reject card
                        </button>
                      </div>
                    </div>
                  )}
                  {selected.status === "rejected" && (
                    <div className="mt-4">
                      <button type="button" disabled={transitioning}
                        onClick={() => void transition(selected,"revise")}
                        className="rounded-xl border px-4 py-3 text-sm font-bold disabled:opacity-40">
                        Return to Draft for corrections
                      </button>
                    </div>
                  )}
                  {selected.status === "published" && <p className="mt-4 text-xs font-bold text-[#28604a]">Published · searchable by students</p>}
                  <p className="mt-4 text-xs text-[#748078]">Updated {selected.updatedAt.slice(0, 10)} · Read-only preview</p>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
