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
      const message = error instanceof Error ? error.message : "";
      const status = /^Gemini provider HTTP (400|401|403|404|408|429|500|502|503|504)$/.exec(message);
      const category = status ? `HTTP_${status[1]}` : error instanceof Error && error.name === "TimeoutError" ? "TIMEOUT" : "UNKNOWN";
      console.error("Translation provider unavailable", category);
    }
  }
  return offlineProvider.translate(request);
}
