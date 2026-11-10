"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import type { LearningCardContent } from "@/lib/cards/schema";
import GenerationSignIn from "./GenerationSignIn";
import { curatedSentenceGrammar } from "@/lib/cards/curated-sentence-grammar.mjs";
import { getCardDisplay } from "@/lib/cards/card-display.mjs";
import SessionStatus from "./SessionStatus";

type CardRow = { id: string; content: LearningCardContent };
type SearchResult = CardRow & { searchedSource: Direction; searchedTerm: string };
type Direction = "de" | "en";

export default function CardSearchPage() {
  const [term, setTerm] = useState("");
  const [source, setSource] = useState<Direction>("de");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [notice, setNotice] = useState("");
  const [missing, setMissing] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!term.trim() || loading) return;
    const submittedTerm = term.trim();
    setLoading(true); setResult(null); setNotice(""); setSaved(false); setMissing(false);
    try {
      const target = source === "de" ? "en" : "de";
      let found: CardRow | null = null;
      // The API already handles German noun articles and curated plurals.
      // Avoid retrying a stripped term and repeating expensive database lookups.
      for (const type of ["word", "sentence"]) {
        const query = new URLSearchParams({ term: term.trim(), source, target, type });
        const response = await fetch("/api/cards/search?" + query, { cache: "no-store" });
        if (!response.ok) throw new Error("Search unavailable");
        const payload: { found: boolean; card: { id: string; content: LearningCardContent } | null } = await response.json();
        if (payload.found && payload.card) { found = payload.card; break; }
      }
      if (found) setResult({ ...found, searchedSource: source, searchedTerm: submittedTerm });
      else setMissing(true);
    } catch { setNotice("Search is temporarily unavailable. Please try again."); }
    finally { setLoading(false); }
  }
  function pronounce(value: string) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(value);
    utterance.lang = result?.content.sourceLanguage === "de" ? "de-DE" : "en-US";
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  }
  function save(card: LearningCardContent) {
    try {
      const key = "lt:cards:v1";
      const existing: unknown = JSON.parse(localStorage.getItem(key) || "[]");
      const cards = Array.isArray(existing) ? existing.filter((c): c is LearningCardContent =>
        Boolean(c) && typeof c === "object" && typeof c.term === "string") : [];
      const next = [...cards.filter(c => !(c.term === card.term && c.type === card.type && c.sourceLanguage === card.sourceLanguage)), card].slice(-200);
      localStorage.setItem(key, JSON.stringify(next));
      setSaved(true);
    } catch { setNotice("Saving is unavailable on this device."); }
  }
  const card = result?.content;
  const display = card && result ? getCardDisplay(card, result.searchedSource, result.searchedTerm) : null;
  const curatedGrammar = card?.type === "sentence" && card.sourceLanguage === "de"
    ? curatedSentenceGrammar.find(entry => entry.term === card.term)
    : undefined;
  const grammarNotes = card?.type === "sentence" ? (card.grammarBreakdown?.length ? card.grammarBreakdown : curatedGrammar?.grammarBreakdown) : undefined;
  const wordNotes = card?.type === "sentence" ? (card.wordBreakdown?.length ? card.wordBreakdown : curatedGrammar?.wordBreakdown) : undefined;
  return <div className="min-h-screen bg-[#fffaf2] text-[#343d4a]">
    <div className="mx-auto max-w-3xl px-5"><SessionStatus /></div>
    <header className="border-b-2 border-[#e8e0d6] bg-white/80">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link href="/" className="text-xl font-black tracking-tight text-[#4f6c77]">✳ LearnTranslate</Link>
        <nav className="flex items-center gap-2 text-sm font-bold"><Link href="/" aria-current="page" className="rounded-full bg-[#e7f2ee] px-3 py-2">Search</Link><Link href="/categories" className="rounded-full px-3 py-2">Categories</Link></nav>
      </div>
    </header>
    <main className="mx-auto max-w-3xl px-5 pb-20 pt-12">
      <div className="mb-8 text-center">
        <span className="rounded-full bg-[#fbe7ba] px-4 py-2 text-xs font-bold uppercase tracking-wider">✦ Your language notebook</span>
        <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">Search a word.<br/><span className="text-[#658b84]">Understand it.</span></h1>
        <p className="mt-4 text-[#64717a]">Useful meanings, grammar and real-life examples — all in one card.</p>
      </div>
      <form onSubmit={search} className="rounded-[28px] border-2 border-[#d8d4cb] bg-white p-4 shadow-[5px_6px_0_#e9e2d7]">
        <label htmlFor="card-term" className="mb-2 block text-sm font-bold">What would you like to learn?</label>
        <input id="card-term" value={term} maxLength={250} onChange={e => {setTerm(e.target.value);setMissing(false);}}
          placeholder={source === "de" ? "e.g. die Gewohnheit" : "e.g. habit"} className="w-full rounded-2xl bg-[#f8f7f3] px-4 py-4 text-lg outline-none focus:ring-2 focus:ring-[#7ea99e]" />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="text-sm">From <select value={source} onChange={e => {setSource(e.target.value as Direction);setTerm("");setResult(null);setNotice("");setSaved(false);setMissing(false);}} className="ml-2 rounded-xl border border-[#d8d4cb] bg-white p-2"><option value="de">German → English</option><option value="en">English → German</option></select></label>
          <button disabled={loading || !term.trim()} className="rounded-2xl bg-[#668d84] px-7 py-3 font-bold text-white disabled:opacity-50">{loading ? "Searching…" : "Search →"}</button>
        </div>
      </form>
      <div className="mt-5 flex flex-wrap gap-2 text-sm"><span className="py-2 text-[#69737a]">Try:</span>{(source === "de" ? ["Gespräch", "Bewerbung", "Gewohnheiten"] : ["habit", "conversation", "rent"]).map(x => <button key={x} type="button" onClick={() => {setTerm(x);setNotice("");setResult(null);setSaved(false);setMissing(false);}} className="rounded-full border border-[#e4d9c5] bg-[#fff1d7] px-3 py-2">{x}</button>)}</div>
      {missing && !loading && <section aria-live="polite" className="mt-8 rounded-[28px] border-2 border-[#e4d7bf] bg-[#fff0d5] p-6 shadow-[4px_5px_0_#eee4d5]">
        <span className="text-xs font-black uppercase tracking-wider text-[#806d53]">✦ New vocabulary</span>
        <h2 className="mt-3 break-words text-xl font-black">No published card for “{term.trim()}” yet</h2>
        <p className="mt-2 text-sm text-[#645e55]">AI-generated learning cards are coming soon. For now, try another search or explore published vocabulary by topic.</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" disabled aria-disabled="true" className="cursor-not-allowed rounded-2xl bg-[#d4d1c9] px-5 py-3 text-sm font-bold text-[#5d5d59]">✧ Generate with AI · Coming soon</button>
          <Link href="/categories" className="rounded-2xl border border-[#b9aa90] bg-white px-5 py-3 text-sm font-bold">Explore categories →</Link>
          <button type="button" onClick={() => setShowSignIn(value => !value)} className="rounded-2xl border border-[#b9aa90] bg-white px-5 py-3 text-sm font-bold">{showSignIn ? "Hide sign-in" : "Sign in (preview)"}</button>
        </div>
        {showSignIn && <GenerationSignIn />}
      </section>}
      {notice && <p role="status" className="mt-8 rounded-2xl border border-[#e8d5b3] bg-[#fff0d4] p-5">{notice}</p>}
      {card && <article aria-live="polite" className="mt-10 overflow-hidden rounded-[30px] border-2 border-[#d9d4c9] bg-white shadow-[6px_7px_0_#e8e1d6]">
        <div className="bg-[#e6f2ec] px-5 py-6 sm:px-9 sm:py-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-black uppercase tracking-wider">{card.type === "word" ? "✎ Word card" : "✉ Sentence card"}</span>
            <button type="button" onClick={() => pronounce(card.term)} className="rounded-full border border-[#a4c5b9] bg-white px-3 py-2 text-xs font-bold sm:text-sm" aria-label={`Listen to ${card.sourceLanguage === "de" ? "German" : "English"} pronunciation`}>🔊 Listen ({card.sourceLanguage === "de" ? "DE" : "EN"})</button>
          </div>
          {display && <>
            <p className="text-xs font-black uppercase tracking-widest text-[#3f6d64]">{display.headlineLanguage === "de" ? "German translation" : "English translation"}</p>
            <h2 className="mt-2 break-words text-3xl font-black leading-tight tracking-tight sm:text-4xl">{display.headline}</h2>
            {display.otherMeanings.length > 0 && <p className="mt-3 break-words text-sm leading-relaxed text-[#436d63]"><span className="font-bold">Also:</span> {display.otherMeanings.join(" · ")}</p>}
            <div className="mt-5 rounded-2xl border border-[#cde2d7] bg-white/75 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[#58766d]">{display.supportingLabel} · {display.supportingLanguage === "de" ? "German" : "English"}</p>
              <p className="mt-1 break-words text-base font-bold leading-relaxed sm:text-lg">{display.supporting}</p>
              {card.pronunciation && <p className="mt-1 text-xs text-[#5d7770]">Pronunciation: {card.pronunciation}</p>}
            </div>
            {card.type === "sentence" && card.naturalMeaning && (
              <p className="mt-3 break-words rounded-2xl border border-[#cde2d7] bg-white/60 px-4 py-3 text-sm leading-relaxed text-[#385f56]">
                <span className="font-black">In context: </span>{card.naturalMeaning}
              </p>
            )}
          </>}
        </div>
        <div className="space-y-4 bg-[#fffdfa] p-4 sm:p-7">
          <p className="px-1 text-xs font-semibold tracking-wide text-[#7e817a]">Tap any section to explore. Your translation stays visible above.</p>

          <details className="group rounded-[24px] border-2 border-[#bbd8cc] bg-[#e6f2ec] p-4 shadow-[3px_4px_0_#d8e8de] sm:p-5">
            <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
              <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#b4d0c3] bg-white/80 text-2xl">✎</span>
              <span className="min-w-0 flex-1 text-lg font-black tracking-tight">Grammar</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 text-[#3f6d64] transition-transform duration-200 group-open:rotate-180"><path d="m6 9 6 6 6-6" /></svg>
            </summary>
            <div className="mt-4 space-y-4 border-t border-[#bbd8cc] pt-4 text-sm leading-relaxed">
              {card.type === "word" ? <>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-white px-3 py-2 font-semibold capitalize">{card.grammar.partOfSpeech}</span>
                  {card.grammar.article && <span className="rounded-full bg-white px-3 py-2 font-semibold">Article: {card.grammar.article}</span>}
                  {card.grammar.plural && <span className="rounded-full bg-white px-3 py-2 font-semibold">Plural: {card.grammar.plural}</span>}
                  {card.grammar.perfect && <span className="rounded-full bg-white px-3 py-2 font-semibold">Perfect: {card.grammar.perfect}</span>}
                  {card.grammar.preterite && <span className="rounded-full bg-white px-3 py-2 font-semibold">Preterite: {card.grammar.preterite}</span>}
                  {card.grammar.auxiliary && <span className="rounded-full bg-white px-3 py-2 font-semibold">Auxiliary: {card.grammar.auxiliary}</span>}
                  {card.grammar.separable !== undefined && <span className="rounded-full bg-white px-3 py-2 font-semibold">{card.grammar.separable ? "Separable verb" : "Non-separable verb"}</span>}
                  {card.grammar.reflexive && <span className="rounded-full bg-white px-3 py-2 font-semibold">Reflexive verb</span>}
                </div>
                {card.grammar.notes?.length ? <ul className="list-inside list-disc space-y-2">{card.grammar.notes.map((note,i) => <li key={i}>{note}</li>)}</ul> : null}
              </> : <>
                {grammarNotes?.length ? <div>
                  <h4 className="font-black">Grammar breakdown</h4>
                  <ul className="mt-2 list-inside list-disc space-y-2">{grammarNotes.map((item,i) => <li key={i}>{item}</li>)}</ul>
                </div> : null}
                {wordNotes?.length ? <div>
                  <h4 className="font-black">Word by word</h4>
                  <ul className="mt-2 space-y-2">{wordNotes.map((item,i) => <li key={i} className="break-words rounded-xl bg-white/75 p-3"><b>{item.word}</b> — {item.meaning}{item.note && <p className="mt-1 text-sm text-[#657180]">{item.note}</p>}</li>)}</ul>
                </div> : null}
                {!grammarNotes?.length && !wordNotes?.length && <p className="text-[#58746b]">No additional grammar breakdown is available for this sentence yet.</p>}
              </>}
            </div>
          </details>

          <details className="group rounded-[24px] border-2 border-[#cfd9ed] bg-[#f1f4fb] p-4 shadow-[3px_4px_0_#e2e6f1] sm:p-5">
            <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
              <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#cad3e6] bg-white/85 text-2xl">📝</span>
              <span className="min-w-0 flex-1 text-lg font-black tracking-tight">Examples ({card.type === "word" ? card.examples.length : card.examples?.length ?? 0})</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 text-[#536a91] transition-transform duration-200 group-open:rotate-180"><path d="m6 9 6 6 6-6" /></svg>
            </summary>
            <div className="mt-4 border-t border-[#cfd9ed] pt-4">
              {(card.examples?.length ?? 0) > 0 ? <ol className="space-y-3">
                {card.examples?.map((example,i) => <li key={i} className="rounded-2xl border border-white bg-white/80 p-4">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#e6ebf7] text-xs font-black text-[#58709b]">{i+1}</span>
                  <p className="mt-2 break-words font-semibold">{example.source}</p>
                  <p className="mt-2 break-words text-sm leading-relaxed text-[#5f6c84]">{example.translation}</p>
                  {example.note && <p className="mt-2 text-xs italic text-[#60728b]">{example.note}</p>}
                </li>)}
              </ol> : <p className="text-sm text-[#60728b]">No curated examples are available for this card yet.</p>}
            </div>
          </details>

          <details className="group rounded-[24px] border-2 border-[#e5cddd] bg-[#f9edf3] p-4 shadow-[3px_4px_0_#eddee8] sm:p-5">
            <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
              <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#e3c6d6] bg-white/80 text-2xl">✿</span>
              <span className="min-w-0 flex-1 text-lg font-black tracking-tight">Other Forms</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 text-[#85576e] transition-transform duration-200 group-open:rotate-180"><path d="m6 9 6 6 6-6" /></svg>
            </summary>
            <div className="mt-4 space-y-4 border-t border-[#e5cddd] pt-4 text-sm leading-relaxed">
                {card.usageNotes?.length ? <div>
                  <h4 className="font-black">Usage notes</h4>
                  <ul className="mt-2 list-inside list-disc space-y-2">{card.usageNotes.map((note,i) => <li key={i}>{note}</li>)}</ul>
                </div> : null}
              {card.type === "word" ? <>
                {card.synonyms?.length ? <div><h4 className="font-black">Synonyms</h4><p className="mt-1 break-words">{card.synonyms.join(" · ")}</p></div> : null}
                {card.antonyms?.length ? <div><h4 className="font-black">Antonyms</h4><p className="mt-1 break-words">{card.antonyms.join(" · ")}</p></div> : null}
                {card.relatedWords?.length ? <div><h4 className="font-black">Related words</h4><p className="mt-1 break-words">{card.relatedWords.join(" · ")}</p></div> : null}
                {card.commonExpressions?.length ? <div><h4 className="font-black">Common expressions</h4><ul className="mt-2 space-y-2">{card.commonExpressions.map((item,i) => <li key={i} className="rounded-xl bg-white/75 p-3"><b>{item.source}</b><p className="mt-1 text-[#76596b]">{item.translation}</p>{item.note && <p className="mt-1 text-xs italic">{item.note}</p>}</li>)}</ul></div> : null}
                {!card.synonyms?.length && !card.antonyms?.length && !card.relatedWords?.length && !card.commonExpressions?.length && !card.usageNotes?.length &&
                  <p className="text-[#806779]">No other forms or related expressions have been curated for this word yet.</p>}
              </> : <>
                {card.alternatives?.length ? <div>
                  <h4 className="font-black">Other ways to say it</h4>
                  <ul className="mt-2 space-y-2">{card.alternatives.map((item,i) => <li key={i} className="break-words rounded-xl bg-white/75 p-3"><b>{item.text}</b> — {item.translation}{item.context && <p className="mt-1 text-sm text-[#657180]">{item.context}</p>}</li>)}</ul>
                </div> : !card.usageNotes?.length ? <p className="text-[#806779]">No alternative expressions have been curated for this sentence yet.</p> : null}
              </>}
            </div>
          </details>

          <button onClick={() => save(card)} className="w-full rounded-2xl border-2 border-[#e8c97b] bg-[#f8df9f] px-5 py-4 font-black text-[#4f4638] shadow-[3px_4px_0_#e9dbc1] transition-transform active:translate-y-0.5">{saved ? "✓ Saved on this device" : "♡ Save this card"}</button>
        </div>
      </article>}
      <p className="mt-10 text-center text-xs text-[#8a8b87]">Only published cards are shown. New AI-generated cards are not yet available in public search.</p>
    </main>
  </div>;
}
