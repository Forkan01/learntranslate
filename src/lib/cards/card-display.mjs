/**
 * Translation-first search card copy. An English reverse lookup can return
 * a curated German→English card, so the display direction must follow the
 * submitted search, not just the stored card direction.
 *
 * @typedef {import("./schema").LearningCardContent} LearningCardContent
 * @typedef {import("./schema").CardLanguage} CardLanguage
 */

/**
 * @param {LearningCardContent} card
 * @param {CardLanguage} searchedSource
 * @param {string} searchedTerm
 */
export function getCardDisplay(card, searchedSource, searchedTerm) {
  const reverseLookup = searchedSource !== card.sourceLanguage;
  const senses = card.translation.split(";").map(sense => sense.trim()).filter(Boolean);

  return {
    headline: reverseLookup ? card.term : (senses[0] || card.translation),
    headlineLanguage: reverseLookup ? card.sourceLanguage : card.targetLanguage,
    supporting: reverseLookup ? searchedTerm.trim() : card.term,
    supportingLanguage: searchedSource,
    supportingLabel: reverseLookup ? "You searched" : "Original",
    otherMeanings: reverseLookup ? [] : senses.slice(1),
  };
}
