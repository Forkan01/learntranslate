"use client";

import type { LearningCardContent } from "@/lib/cards/schema";
import { getCardDisplay } from "@/lib/cards/card-display.mjs";
import { curatedSentenceGrammar } from "@/lib/cards/curated-sentence-grammar.mjs";

type Props = {
  card: LearningCardContent;
  expanded: boolean;
  onToggle: () => void;
  onSave?: () => void;
  onRemove?: () => void;
  isSaved?: boolean;
};

const Chevron = ({ color }: { color: string }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round"
    className={`h-5 w-5 shrink-0 transition-transform duration-200 group-open:rotate-180 ${color}`}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export default function LearningCard({ card, expanded, onToggle, onSave, onRemove, isSaved = false }: Props) {
  // Category and device-saved cards are displayed in their stored direction.
  // The opposite-language translation is always the main headline.
  const display = getCardDisplay(card, card.sourceLanguage, card.term);
  const curatedGrammar = card.type === "sentence" && card.sourceLanguage === "de"
    ? curatedSentenceGrammar.find(entry => entry.term === card.term)
    : undefined;
  const grammarNotes = card.type === "sentence"
    ? (card.grammarBreakdown?.length ? card.grammarBreakdown : curatedGrammar?.grammarBreakdown)
    : undefined;
  const wordNotes = card.type === "sentence"
    ? (card.wordBreakdown?.length ? card.wordBreakdown : curatedGrammar?.wordBreakdown)
    : undefined;

  function pronounce() {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(card.term);
    utterance.lang = card.sourceLanguage === "de" ? "de-DE" : "en-US";
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  }

  return <article className="overflow-hidden rounded-[30px] border-2 border-[#d9d4c9] bg-white shadow-[4px_5px_0_#e8e1d6]">
    <div className="bg-[#e6f2ec] px-5 py-6 sm:px-7 sm:py-7">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-black uppercase tracking-wider">
          {card.type === "word" ? "✎ Word card" : "✉ Sentence card"}
        </span>
        <button type="button" onClick={pronounce}
          aria-label={`Listen to ${card.sourceLanguage === "de" ? "German" : "English"} pronunciation`}
          className="rounded-full border border-[#a4c5b9] bg-white px-3 py-2 text-xs font-bold">
          🔊 Listen ({card.sourceLanguage === "de" ? "DE" : "EN"})
        </button>
      </div>
      <p className="text-xs font-black uppercase tracking-widest text-[#3f6d64]">
        {display.headlineLanguage === "de" ? "German translation" : "English translation"}
      </p>
      <h2 className="mt-2 break-words text-3xl font-black leading-tight tracking-tight sm:text-4xl">{display.headline}</h2>
      {display.otherMeanings.length > 0 && <p className="mt-3 break-words text-sm text-[#436d63]">
        <span className="font-bold">Also:</span> {display.otherMeanings.join(" · ")}
      </p>}
      <div className="mt-4 rounded-2xl border border-[#cde2d7] bg-white/75 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[#58766d]">
          {display.supportingLabel} · {display.supportingLanguage === "de" ? "German" : "English"}
        </p>
        <p className="mt-1 break-words text-base font-bold sm:text-lg">{display.supporting}</p>
        {card.pronunciation && <p className="mt-1 text-xs text-[#5d7770]">Pronunciation: {card.pronunciation}</p>}
      </div>
      {card.type === "sentence" && card.naturalMeaning && <p className="mt-3 break-words rounded-2xl border border-[#cde2d7] bg-white/60 px-4 py-3 text-sm text-[#385f56]">
        <span className="font-black">In context: </span>{card.naturalMeaning}
      </p>}
      <button type="button" onClick={onToggle} aria-expanded={expanded}
        className="mt-4 flex w-full items-center justify-between rounded-xl border border-[#bbd8cc] bg-white/80 px-4 py-3 text-left text-sm font-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3f6d64]">
        {expanded ? "Hide card details" : "Explore card"}
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round"
          className={`h-5 w-5 shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </div>

    {expanded && <div className="space-y-4 bg-[#fffdfa] p-4 sm:p-7">
      <p className="px-1 text-xs font-semibold text-[#7e817a]">Tap a section to explore. The translation stays visible above.</p>

      <details className="group rounded-[24px] border-2 border-[#bbd8cc] bg-[#e6f2ec] p-4 shadow-[3px_4px_0_#d8e8de] sm:p-5">
        <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#b4d0c3] bg-white/80 text-2xl">✎</span>
          <span className="min-w-0 flex-1 text-lg font-black">Grammar</span>
          <Chevron color="text-[#3f6d64]" />
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
            {grammarNotes?.length ? <div><h4 className="font-black">Grammar breakdown</h4><ul className="mt-2 list-inside list-disc space-y-2">{grammarNotes.map((note,i) => <li key={i}>{note}</li>)}</ul></div> : null}
            {wordNotes?.length ? <div><h4 className="font-black">Word by word</h4><ul className="mt-2 space-y-2">{wordNotes.map((item,i) => <li key={i} className="break-words rounded-xl bg-white/75 p-3"><b>{item.word}</b> — {item.meaning}{item.note && <p className="mt-1 text-xs text-[#657180]">{item.note}</p>}</li>)}</ul></div> : null}
            {!grammarNotes?.length && !wordNotes?.length && <p className="text-[#58746b]">No additional grammar breakdown is available for this sentence yet.</p>}
          </>}
        </div>
      </details>

      <details className="group rounded-[24px] border-2 border-[#cfd9ed] bg-[#f1f4fb] p-4 shadow-[3px_4px_0_#e2e6f1] sm:p-5">
        <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#cad3e6] bg-white/85 text-2xl">📝</span>
          <span className="min-w-0 flex-1 text-lg font-black">Examples ({card.examples?.length ?? 0})</span>
          <Chevron color="text-[#536a91]" />
        </summary>
        <div className="mt-4 border-t border-[#cfd9ed] pt-4">
          {card.examples?.length ? <ol className="space-y-3">
            {card.examples.map((example,i) => <li key={i} className="rounded-2xl border border-white bg-white/80 p-4">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#e6ebf7] text-xs font-black text-[#58709b]">{i+1}</span>
              <p className="mt-2 break-words font-semibold">{example.source}</p>
              <p className="mt-2 break-words text-sm leading-relaxed text-[#5f6c84]">{example.translation}</p>
              {example.note && <p className="mt-2 text-xs italic text-[#60728b]">{example.note}</p>}
            </li>)}
          </ol> : <p className="text-sm text-[#60728b]">No curated examples are available for this card yet.</p>}
        </div>
      </details>

      {card.type === "word" && <details className="group rounded-[24px] border-2 border-[#e5cddd] bg-[#f9edf3] p-4 shadow-[3px_4px_0_#eddee8] sm:p-5">
        <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#e3c6d6] bg-white/80 text-2xl">↔</span>
          <span className="min-w-0 flex-1 text-lg font-black">Synonyms &amp; Antonyms</span>
          <Chevron color="text-[#85576e]" />
        </summary>
        <div className="mt-4 space-y-4 border-t border-[#e5cddd] pt-4 text-sm leading-relaxed">
          <section><h4 className="font-black">Synonyms</h4>
            {card.synonyms?.length ? <ul className="mt-2 flex flex-wrap gap-2">{card.synonyms.map((word,i) => <li key={i} className="max-w-full break-words rounded-full border border-[#e4cddd] bg-white/85 px-3 py-2 font-semibold">{word}</li>)}</ul>
              : <p className="mt-2 text-[#806779]">No curated synonyms are available for this word yet.</p>}
          </section>
          <section><h4 className="font-black">Antonyms</h4>
            {card.antonyms?.length ? <ul className="mt-2 flex flex-wrap gap-2">{card.antonyms.map((word,i) => <li key={i} className="max-w-full break-words rounded-full border border-[#e4cddd] bg-white/85 px-3 py-2 font-semibold">{word}</li>)}</ul>
              : <p className="mt-2 text-[#806779]">No direct antonyms have been curated for this word yet.</p>}
          </section>
        </div>
      </details>}

      <details className="group rounded-[24px] border-2 border-[#e8d6a8] bg-[#fff2d9] p-4 shadow-[3px_4px_0_#efe4c9] sm:p-5">
        <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#ebdab2] bg-white/80 text-2xl">✿</span>
          <span className="min-w-0 flex-1 text-lg font-black">Other Forms</span>
          <Chevron color="text-[#887047]" />
        </summary>
        <div className="mt-4 space-y-4 border-t border-[#e8d6a8] pt-4 text-sm leading-relaxed">
          {card.usageNotes?.length ? <div><h4 className="font-black">Usage notes</h4><ul className="mt-2 list-inside list-disc space-y-2">{card.usageNotes.map((note,i) => <li key={i}>{note}</li>)}</ul></div> : null}
          {card.type === "word" ? <>
            {card.relatedWords?.length ? <div><h4 className="font-black">Related words</h4><p className="mt-1 break-words">{card.relatedWords.join(" · ")}</p></div> : null}
            {card.commonExpressions?.length ? <div><h4 className="font-black">Common expressions</h4><ul className="mt-2 space-y-2">{card.commonExpressions.map((item,i) => <li key={i} className="rounded-xl bg-white/75 p-3"><b>{item.source}</b><p className="mt-1 text-[#76596b]">{item.translation}</p>{item.note && <p className="mt-1 text-xs italic">{item.note}</p>}</li>)}</ul></div> : null}
            {!card.relatedWords?.length && !card.commonExpressions?.length && !card.usageNotes?.length && <p className="text-[#806779]">No other forms or related expressions have been curated for this word yet.</p>}
          </> : <>
            {card.alternatives?.length ? <div><h4 className="font-black">Other ways to say it</h4><ul className="mt-2 space-y-2">{card.alternatives.map((item,i) => <li key={i} className="break-words rounded-xl bg-white/75 p-3"><b>{item.text}</b> — {item.translation}{item.context && <p className="mt-1 text-xs text-[#657180]">{item.context}</p>}</li>)}</ul></div>
              : !card.usageNotes?.length ? <p className="text-[#806779]">No alternative expressions have been curated for this sentence yet.</p> : null}
          </>}
        </div>
      </details>

      {onSave && <button type="button" onClick={onSave}
        className="w-full rounded-2xl border-2 border-[#e8c97b] bg-[#f8df9f] px-5 py-4 font-black text-[#4f4638] shadow-[3px_4px_0_#e9dbc1]">
        {isSaved ? "✓ Saved on this device" : "♡ Save this card"}
      </button>}
    </div>}
    {onRemove && <div className="flex justify-end border-t border-[#e8e0d6] bg-[#fffdfa] px-5 py-3">
      <button type="button" onClick={onRemove}
        aria-label={`Remove ${card.term} from saved cards`}
        className="rounded-xl border border-[#e5cddd] bg-white px-4 py-2 text-sm font-bold text-[#85576e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#85576e]">
        Remove from saved
      </button>
    </div>}
  </article>;
}
