"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LearningCardContent } from "@/lib/cards/schema";
import LearningCard from "./LearningCard";
import {
  SAVED_TOPICS, SAVED_TOPIC_STORAGE_KEY, savedCardKey, parseSavedTopics,
  assignSavedTopic, removeSavedTopic, filterSavedCards, isSavedTopic
} from "@/lib/cards/saved-topics.mjs";

type Category = { id: string; slug: string; name: string; description?: string };
type CardRow = { id: string; term: string; type: "word" | "sentence"; content: LearningCardContent };

const storageKey = "lt:cards:v1";
const icons: Record<string, string> = {
  "daily-life": "☀️", "conversations": "💬", "feelings-emotions": "💗", "work-career": "💼",
  "shopping": "🛍️", "food-restaurants": "🍽️", "travel-transport": "🚆", "health": "🌿",
  "housing": "🏡", "education": "📚", "technology": "💻", "german-bureaucracy": "📋"
};

function isSavedCard(value: unknown): value is LearningCardContent {
  if (!value || typeof value !== "object") return false;
  const card = value as Record<string, unknown>;
  if (typeof card.term !== "string" || !card.term.trim() || typeof card.translation !== "string"
    || !["de", "en"].includes(String(card.sourceLanguage))
    || !["de", "en"].includes(String(card.targetLanguage))
    || card.sourceLanguage === card.targetLanguage) return false;
  if (card.type === "word") {
    const grammar = card.grammar;
    return !!grammar && typeof grammar === "object" && typeof (grammar as Record<string, unknown>).partOfSpeech === "string"
      && Array.isArray(card.examples);
  }
  return card.type === "sentence" && typeof card.naturalMeaning === "string"
    && (card.examples === undefined || Array.isArray(card.examples));
}

function readSavedCards(): LearningCardContent[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(value) ? value.filter(isSavedCard).slice(-200).reverse() : [];
  } catch {
    return [];
  }
}

function readSavedTopics(): Record<string, string> {
  try {
    return parseSavedTopics(localStorage.getItem(SAVED_TOPIC_STORAGE_KEY));
  } catch {
    return {};
  }
}

function sameCard(a: LearningCardContent, b: LearningCardContent): boolean {
  return a.type === b.type && a.term === b.term && a.sourceLanguage === b.sourceLanguage;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Category | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [savedCards, setSavedCards] = useState<LearningCardContent[]>([]);
  const [topicAssignments, setTopicAssignments] = useState<Record<string, string>>({});
  const [savedTopicFilter, setSavedTopicFilter] = useState("all");
  const [savedSearch, setSavedSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/categories").then(async response => {
      if (!response.ok) throw Error();
      return response.json();
    }).then(data => {
      if (active) setCategories(data.categories);
    }).catch(() => {
      if (active) setError("Categories are temporarily unavailable.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    // The existing Search Save button writes to localStorage. Read the same key,
    // including after a storage change in another browser tab.
    const load = () => {
      setSavedCards(readSavedCards());
      setTopicAssignments(readSavedTopics());
    };
    const timer = window.setTimeout(load, 0);
    window.addEventListener("storage", load);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", load);
    };
  }, []);

  async function openCategory(category: Category) {
    setShowSaved(false);
    setSelected(category);
    setCards([]);
    setExpanded(null);
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/categories?slug=" + encodeURIComponent(category.slug));
      if (!response.ok) throw Error();
      const data: { cards: CardRow[] } = await response.json();
      setCards(data.cards);
    } catch {
      setError("Could not load vocabulary. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function openSaved() {
    setSelected(null);
    setShowSaved(true);
    setExpanded(null);
    setNotice("");
    setError("");
    setSavedCards(readSavedCards());
    setTopicAssignments(readSavedTopics());
    setSavedTopicFilter("all");
    setSavedSearch("");
  }

  function backToCategories() {
    setSelected(null);
    setShowSaved(false);
    setExpanded(null);
    setNotice("");
    setError("");
  }

  function save(card: LearningCardContent) {
    try {
      const old = readSavedCards().reverse();
      const next = [...old.filter(value => !sameCard(value, card)), card].slice(-200);
      localStorage.setItem(storageKey, JSON.stringify(next));
      setSavedCards([...next].reverse());
      // A card saved from a published category gets that topic automatically,
      // unless the user has already assigned it a different topic.
      if (selected && isSavedTopic(selected.slug)) {
        try {
          const existingTopics = readSavedTopics();
          if (!Object.hasOwn(existingTopics, savedCardKey(card))) {
            const assigned = assignSavedTopic(existingTopics, card, selected.slug);
            localStorage.setItem(SAVED_TOPIC_STORAGE_KEY, JSON.stringify(assigned));
            setTopicAssignments(assigned);
          }
        } catch {
          setNotice("Card saved, but its topic could not be assigned on this device.");
          return;
        }
      }
      setNotice("Card saved on this device.");
    } catch {
      setNotice("Saving is unavailable on this device.");
    }
  }

  function removeSaved(card: LearningCardContent) {
    try {
      const next = readSavedCards().reverse().filter(value => !sameCard(value, card));
      localStorage.setItem(storageKey, JSON.stringify(next));
      setSavedCards([...next].reverse());
      setExpanded(null);
      try {
        const topics = removeSavedTopic(readSavedTopics(), card);
        localStorage.setItem(SAVED_TOPIC_STORAGE_KEY, JSON.stringify(topics));
        setTopicAssignments(topics);
      } catch {
        setNotice("Card removed, but its topic label could not be cleared.");
        return;
      }
      setNotice("Card removed from this device. You can save it again from Search or Categories.");
    } catch {
      setNotice("Removing this card is unavailable on this device.");
    }
  }

  function changeSavedTopic(card: LearningCardContent, slug: string) {
    try {
      const next = assignSavedTopic(readSavedTopics(), card, slug);
      localStorage.setItem(SAVED_TOPIC_STORAGE_KEY, JSON.stringify(next));
      setTopicAssignments(next);
      setExpanded(null);
      const name = SAVED_TOPICS.find(topic => topic.slug === slug)?.name;
      setNotice(name ? "Card organized under " + name + "." : "Card moved to Unsorted.");
    } catch {
      setNotice("Topic assignment is unavailable on this device.");
    }
  }

  const viewingCards = Boolean(selected) || showSaved;
  const filteredSavedCards = filterSavedCards(savedCards, topicAssignments, savedTopicFilter, savedSearch);
  const unsortedCount = savedCards.filter(card => !topicAssignments[savedCardKey(card)]).length;
  const visibleCards = showSaved
    ? filteredSavedCards.map(content => ({ id: "saved-" + savedCardKey(content), content }))
    : cards.map(card => ({ id: card.id, content: card.content }));

  return <div className="min-h-screen bg-[#fffaf2] text-[#343d4a]">
    <header className="border-b-2 border-[#e8e0d6] bg-white/80">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5">
        <Link href="/" className="text-xl font-black text-[#4f6c77]">✳ LearnTranslate</Link>
        <nav className="flex gap-2 text-sm font-bold">
          <Link href="/" className="rounded-full px-3 py-2">Search</Link>
          <Link href="/categories" aria-current="page" className="rounded-full bg-[#e7f2ee] px-3 py-2">Categories</Link>
        </nav>
      </div>
    </header>
    <main className="mx-auto max-w-4xl px-5 pb-20 pt-12">
      {viewingCards ? <>
        <button type="button" onClick={backToCategories}
          className="mb-5 rounded-full bg-[#fff0d5] px-4 py-2 font-bold">← All categories</button>
        <h1 className="break-words text-3xl font-black">
          {showSaved ? "♡ Saved on this device" : `${selected ? icons[selected.slug] || "✦" : ""} ${selected?.name || ""}`}
        </h1>
        <p className="mt-2 text-[#68727b]">
          {showSaved ? "Your saved Word and Sentence Cards are stored in this browser." : "Published vocabulary for real-life situations"}
        </p>
      </> : <>
        <span className="rounded-full bg-[#fbe7ba] px-4 py-2 text-xs font-bold uppercase tracking-wider">✦ Learn by situation</span>
        <h1 className="mt-6 text-4xl font-black">Explore everyday <span className="text-[#668d84]">German.</span></h1>
        <p className="mt-3 text-[#68727b]">Choose a topic or revisit cards you saved on this device.</p>
      </>}

      {error && <p role="alert" className="mt-6 rounded-2xl bg-[#fff0d5] p-4">{error}</p>}
      {notice && <p role="status" className="mt-6 rounded-2xl bg-[#e6f2ec] p-4">{notice}</p>}
      {loading && !showSaved && <p role="status" className="mt-8">Loading vocabulary…</p>}

      {!viewingCards && <div className="mt-9 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <button type="button" onClick={openSaved}
          className="min-h-36 rounded-[26px] border-2 border-[#d8c9e5] bg-[#f9edf3] p-5 text-left shadow-[4px_5px_0_#ebe4d9] transition-transform active:translate-y-1">
          <span className="text-3xl">♡</span>
          <span className="mt-4 block font-black">Saved on this device</span>
          <span className="mt-2 block text-xs text-[#6e7780]">{savedCards.length} saved cards · Explore</span>
        </button>
        {categories.map((category, i) => <button type="button" key={category.id}
          onClick={() => openCategory(category)}
          className={`min-h-36 rounded-[26px] border-2 border-[#e4ddd1] p-5 text-left shadow-[4px_5px_0_#ebe4d9] transition-transform active:translate-y-1 ${i % 3 === 0 ? "bg-[#e6f2ec]" : i % 3 === 1 ? "bg-[#fff0d5]" : "bg-[#f5e9f1]"}`}>
          <span className="text-3xl">{icons[category.slug] || "✦"}</span>
          <span className="mt-4 block font-black">{category.name}</span>
          <span className="mt-2 block text-xs text-[#6e7780]">Explore →</span>
        </button>)}
      </div>}

      {showSaved && <section className="mt-6 rounded-[24px] border-2 border-[#d8c9e5] bg-[#f9edf3] p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-bold" htmlFor="saved-search">Find a saved card
            <input id="saved-search" type="search" value={savedSearch} maxLength={250}
              onChange={event => { setSavedSearch(event.target.value); setExpanded(null); }}
              placeholder="Word or translation"
              className="mt-2 w-full rounded-xl border border-[#e2cddd] bg-white p-3 font-normal outline-none focus:ring-2 focus:ring-[#bb94ad]" />
          </label>
          <label className="block text-sm font-bold" htmlFor="saved-topic-filter">Filter by topic
            <select id="saved-topic-filter" value={savedTopicFilter}
              onChange={event => { setSavedTopicFilter(event.target.value); setExpanded(null); }}
              className="mt-2 w-full rounded-xl border border-[#e2cddd] bg-white p-3 font-normal outline-none focus:ring-2 focus:ring-[#bb94ad]">
              <option value="all">All saved cards ({savedCards.length})</option>
              <option value="unsorted">Unsorted ({unsortedCount})</option>
              {SAVED_TOPICS.map(topic => <option key={topic.slug} value={topic.slug}>
                {topic.name} ({savedCards.filter(card => topicAssignments[savedCardKey(card)] === topic.slug).length})
              </option>)}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs font-semibold text-[#806779]">
          Showing {filteredSavedCards.length} of {savedCards.length} saved cards. Topics are stored on this device.
        </p>
      </section>}
      {viewingCards && (!loading || showSaved) && <div className="mt-8 space-y-5">
        {visibleCards.length === 0 && <p className="rounded-2xl bg-white p-5">
          {showSaved ? (savedCards.length ? "No saved cards match this topic or search." : "No saved cards yet. Search for a word or sentence and tap Save this card.") : "No published cards in this category yet."}
        </p>}
        {visibleCards.map(({ id, content }, index) => <div key={id} className="space-y-2">
          {showSaved && <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#e5cddd] bg-[#f9edf3] px-4 py-3">
            <label htmlFor={"saved-card-topic-" + index} className="text-sm font-bold">Organize by topic</label>
            <select id={"saved-card-topic-" + index}
              value={topicAssignments[savedCardKey(content)] || ""}
              onChange={event => changeSavedTopic(content, event.target.value)}
              aria-label={"Topic for " + content.term}
              className="max-w-full rounded-xl border border-[#ddc0d1] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#bb94ad]">
              <option value="">Unsorted</option>
              {SAVED_TOPICS.map(topic => <option key={topic.slug} value={topic.slug}>{topic.name}</option>)}
            </select>
          </div>}
          <LearningCard key={id}
          card={content}
          expanded={expanded === id}
          onToggle={() => setExpanded(current => current === id ? null : id)}
          isSaved={savedCards.some(saved => sameCard(saved, content))}
          onSave={showSaved ? undefined : () => save(content)}
          onRemove={showSaved ? () => removeSaved(content) : undefined}
        />
        </div>)}
      </div>}
    </main>
  </div>;
}
