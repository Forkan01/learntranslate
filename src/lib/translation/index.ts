import { offlineProvider } from "./offline";
import type { TranslationRequest, TranslationResult } from "./types";
export type { Language, TranslationRequest, TranslationResult, TranslationProvider } from "./types";
export async function translate(request: TranslationRequest): Promise<TranslationResult | null> {
  if (!request.text.trim() || request.text.length > 2000 || request.source === request.target) return null;
  return offlineProvider.translate(request);
}
