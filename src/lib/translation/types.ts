export type Language = "en" | "de";
export type TranslationRequest = { text: string; source: Language; target: Language };
export type TranslationResult = { sourceText: string; translatedText: string; source: Language; target: Language; grammar: string; examples: { source: string; target: string }[]; provider: "offline" | "ai" };
export interface TranslationProvider { translate(request: TranslationRequest): Promise<TranslationResult | null> }
