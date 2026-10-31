import type { TranslationProvider, TranslationRequest, TranslationResult } from "./types";
const examples = [
  { en: "I am proud of you.", de: "Ich bin stolz auf dich.", grammar: "stolz auf takes the accusative case." },
  { en: "It depends.", de: "Es kommt darauf an.", grammar: "Es kommt darauf an is a common everyday expression." },
  { en: "I am looking forward to meeting you.", de: "Ich freue mich darauf, dich kennenzulernen.", grammar: "sich freuen auf expresses anticipation." },
];
export const offlineProvider: TranslationProvider = {
  async translate({ text, source, target }: TranslationRequest): Promise<TranslationResult | null> {
    if (source === target) return null;
    const entry = examples.find(item => item[source].trim().toLocaleLowerCase() === text.trim().toLocaleLowerCase());
    if (!entry) return null;
    return { sourceText: entry[source], translatedText: entry[target], source, target, grammar: entry.grammar, examples: [], provider: "offline" };
  }
};
