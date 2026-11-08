// V1-H.37A: read-only content-quality audit; never modifies published cards.
export function auditLearningCard(content) {
  const issues = [];
  const nonempty = value => typeof value === "string" && value.trim().length > 0;
  if (!content || typeof content !== "object" || Array.isArray(content)) return ["invalid_card"];
  if (content.schemaVersion !== 1) issues.push("schema_version");
  if (!["word", "sentence"].includes(content.type)) issues.push("card_type");
  if (!["de", "en"].includes(content.sourceLanguage) || !["de", "en"].includes(content.targetLanguage) || content.sourceLanguage === content.targetLanguage) issues.push("language_pair");
  if (!nonempty(content.term)) issues.push("missing_term");
  if (!nonempty(content.translation)) issues.push("missing_translation");
  if (content.type === "word") {
    if (!content.grammar || typeof content.grammar !== "object" || !nonempty(content.grammar.partOfSpeech)) issues.push("missing_part_of_speech");
    if (content.grammar?.partOfSpeech === "noun" && content.sourceLanguage === "de" && !["der", "die", "das"].includes(content.grammar.article)) issues.push("missing_german_noun_article");
    if (!Array.isArray(content.examples)) issues.push("missing_examples");
    else {
      if (content.examples.length !== 5) issues.push("word_examples_not_five");
      content.examples.forEach((example, index) => {
        if (!nonempty(example?.source) || !nonempty(example?.translation)) issues.push("incomplete_example_" + (index + 1));
      });
    }
  }
  if (content.type === "sentence" && !nonempty(content.naturalMeaning)) issues.push("missing_natural_meaning");
  return issues;
}
