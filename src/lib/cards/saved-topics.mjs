/** Browser-only topic organization for locally saved learning cards.
 * Assignments live outside the H.40A-C card array so existing saved cards and
 * the public API/database schema remain completely unchanged.
 * @typedef {import("./schema").LearningCardContent} LearningCardContent
 */

export const SAVED_TOPIC_STORAGE_KEY = "lt:saved-card-topics:v1";

export const SAVED_TOPICS = Object.freeze([
  { slug: "daily-life", name: "Daily Life" },
  { slug: "conversations", name: "Conversations" },
  { slug: "feelings-emotions", name: "Feelings & Emotions" },
  { slug: "work-career", name: "Work & Career" },
  { slug: "shopping", name: "Shopping" },
  { slug: "food-restaurants", name: "Food & Restaurants" },
  { slug: "travel-transport", name: "Travel & Transport" },
  { slug: "health", name: "Health" },
  { slug: "housing", name: "Housing" },
  { slug: "education", name: "Education" },
  { slug: "technology", name: "Technology" },
  { slug: "german-bureaucracy", name: "German Bureaucracy" },
]);

const knownTopics = new Set(SAVED_TOPICS.map(topic => topic.slug));

/** @param {string} slug */
export function isSavedTopic(slug) {
  return knownTopics.has(slug);
}

/** @param {LearningCardContent} card */
export function savedCardKey(card) {
  return JSON.stringify([card.type, card.sourceLanguage, card.term]);
}

/** @param {string} key */
function validCardKey(key) {
  try {
    const data = JSON.parse(key);
    return Array.isArray(data) && data.length === 3 &&
      ["word", "sentence"].includes(data[0]) &&
      ["de", "en"].includes(data[1]) &&
      typeof data[2] === "string" && data[2].length > 0 && data[2].length <= 250;
  } catch {
    return false;
  }
}

/**
 * A corrupt or stale companion key never hides or changes the actual saved cards.
 * Invalid / unknown assignments are ignored, and data is bounded to 200 cards.
 * @param {string | null} raw
 * @returns {Record<string, string>}
 */
export function parseSavedTopics(raw) {
  /** @type {Record<string, string>} */
  const safe = Object.create(null);
  if (!raw || raw.length > 40000) return safe;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return safe;
    for (const [key, slug] of Object.entries(parsed).slice(0, 200)) {
      if (validCardKey(key) && typeof slug === "string" && isSavedTopic(slug)) {
        safe[key] = slug;
      }
    }
  } catch {
    return safe;
  }
  return safe;
}

/**
 * Empty slug deliberately marks Unsorted without mutating the saved card.
 * @param {Record<string, string>} current
 * @param {LearningCardContent} card
 * @param {string} slug
 * @returns {Record<string, string>}
 */
export function assignSavedTopic(current, card, slug) {
  if (slug !== "" && !isSavedTopic(slug)) throw new Error("Unknown saved topic");
  const next = { ...current };
  const key = savedCardKey(card);
  if (slug === "") delete next[key];
  else next[key] = slug;
  return next;
}

/**
 * @param {Record<string, string>} current
 * @param {LearningCardContent} card
 */
export function removeSavedTopic(current, card) {
  return assignSavedTopic(current, card, "");
}

/**
 * Filter by a known topic, Unsorted, or All. Search the original AND translation.
 * @param {LearningCardContent[]} cards
 * @param {Record<string, string>} assignments
 * @param {string} topicFilter
 * @param {string} query
 */
export function filterSavedCards(cards, assignments, topicFilter, query) {
  const normalized = query.trim().toLocaleLowerCase();
  return cards.filter(card => {
    const slug = assignments[savedCardKey(card)] || "";
    const matchesTopic = topicFilter === "all" || (topicFilter === "unsorted"
      ? !slug : slug === topicFilter && isSavedTopic(slug));
    const matchesSearch = !normalized || card.term.toLocaleLowerCase().includes(normalized) ||
      card.translation.toLocaleLowerCase().includes(normalized);
    return matchesTopic && matchesSearch;
  });
}
