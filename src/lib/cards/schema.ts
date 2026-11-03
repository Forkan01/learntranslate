/**
 * LearnTranslate V1 — shared vocabulary card contract.
 * Search and category browsing consume the SAME approved cards.
 * This module intentionally has no provider, database, or authentication dependency.
 */
export type CardLanguage = "de" | "en";
export type CardType = "word" | "sentence";
export type CardStatus = "draft" | "review" | "published" | "rejected";
export type PartOfSpeech =
  | "noun" | "verb" | "adjective" | "adverb" | "pronoun" | "preposition"
  | "conjunction" | "interjection" | "article" | "particle" | "other";

export interface BilingualExample {
  source: string;
  translation: string;
  /** Optional short explanation of the example's grammar or usage. */
  note?: string;
}

export interface WordGrammar {
  partOfSpeech: PartOfSpeech;
  /** Nouns: e.g. "die". Never invent articles for non-nouns. */
  article?: "der" | "die" | "das";
  plural?: string;
  /** Verbs: e.g. "hat gemacht" or "ist gegangen". */
  perfect?: string;
  preterite?: string;
  separable?: boolean;
  reflexive?: boolean;
  auxiliary?: "haben" | "sein";
  /** Case/government and other concise grammatical details. */
  notes?: string[];
}

export interface CardBase {
  schemaVersion: 1;
  type: CardType;
  sourceLanguage: CardLanguage;
  targetLanguage: CardLanguage;
  /** Exact display text, including capitalization and diacritics. */
  term: string;
  /** Natural primary translation, not a literal word-by-word gloss. */
  translation: string;
  /** Optional usage register: formal, informal, neutral, etc. */
  register?: string;
  /** Pronunciation display (e.g. IPA); audio uses browser TTS. */
  pronunciation?: string;
  /** Notes are collapsible unless otherwise stated by the UI. */
  usageNotes?: string[];
}

export interface WordCardContent extends CardBase {
  type: "word";
  grammar: WordGrammar;
  /** V1 word cards aim for five curated examples. */
  examples: BilingualExample[];
  synonyms?: string[];
  antonyms?: string[];
  relatedWords?: string[];
  commonExpressions?: BilingualExample[];
}

export interface SentenceCardContent extends CardBase {
  type: "sentence";
  /** Explanation of intended meaning and real-world context. */
  naturalMeaning: string;
  grammarBreakdown?: string[];
  wordBreakdown?: Array<{ word: string; meaning: string; note?: string }>;
  alternatives?: Array<{ text: string; translation: string; context?: string }>;
  examples?: BilingualExample[];
}

export type LearningCardContent = WordCardContent | SentenceCardContent;

export interface StoredLearningCard {
  id: string;
  /** Canonical normalized key used for deduplication; locale-aware. */
  searchKey: string;
  status: CardStatus;
  content: LearningCardContent;
  createdAt: string;
  updatedAt: string;
}

export interface LearningCategory {
  id: string;
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  parentId?: string | null;
  sortOrder: number;
}

export interface CategoryCard {
  categoryId: string;
  cardId: string;
  sortOrder: number;
}

/** Unicode normalization is for lookup only; display text remains unchanged. */
export function normalizeSearchTerm(value: string, language: CardLanguage): string {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  return normalized.toLocaleLowerCase(language === "de" ? "de-DE" : "en-US");
}

export function makeCardSearchKey(
  term: string,
  sourceLanguage: CardLanguage,
  targetLanguage: CardLanguage,
  type: CardType
): string {
  if (sourceLanguage === targetLanguage) throw new Error("Source and target languages must differ");
  const normalized = normalizeSearchTerm(term, sourceLanguage);
  if (!normalized) throw new Error("Search term must not be empty");
  return [type, sourceLanguage, targetLanguage, normalized].join(":");
}
