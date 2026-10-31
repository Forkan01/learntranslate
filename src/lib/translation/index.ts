import { offlineProvider } from "./offline";
import { geminiProvider } from "./gemini";
import type { TranslationRequest, TranslationResult } from "./types";
export type { Language, TranslationRequest, TranslationResult, TranslationProvider } from "./types";

export async function translate(request: TranslationRequest): Promise<TranslationResult | null> {
  if (!request.text.trim() || request.text.length > 2000 || request.source === request.target) return null;
  if (process.env.GEMINI_API_KEY) {
    try {
      const result = await geminiProvider.translate(request);
      if (result) return result;
    } catch (error) {
      // Do not log API keys, user input, or upstream response bodies.
      console.error("Translation provider unavailable", error instanceof Error ? error.message : "UnknownError");
    }
  }
  return offlineProvider.translate(request);
}
