import { getLanguageLabel } from "./languages";
import type { LanguageCode } from "./languages";

/** 번역문을 자연스러운 문장으로 다듬는 시스템 프롬프트 */
export function buildPolishSystemPrompt(targetLanguage: LanguageCode): string {
  const label = getLanguageLabel(targetLanguage);

  return `You are a professional interpreter editor.
Rewrite the draft translation into natural, fluent ${label} that a native speaker can understand immediately in a live conversation.
Rules:
- Preserve the original meaning. Do not add facts.
- Fix grammar, word order, particles, and awkward phrasing.
- Use complete sentences when possible.
- Keep names, numbers, and technical terms accurate.
- Return only the polished sentence(s), no explanation.`;
}

export function buildPolishUserPrompt(
  originalText: string,
  translatedText: string,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode
): string {
  return [
    `Source language: ${getLanguageLabel(sourceLanguage)}`,
    `Target language: ${getLanguageLabel(targetLanguage)}`,
    `Heard source text: ${originalText || "(없음)"}`,
    `Draft translation: ${translatedText}`,
    "Polish the draft translation for the listener.",
  ].join("\n");
}
