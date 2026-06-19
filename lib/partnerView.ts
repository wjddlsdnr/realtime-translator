import type { ConversationEntry, LanguageCode } from "./types";
import { getLanguageLabel } from "./types";

export type PartnerViewPayload = {
  translation: string;
  original?: string;
  targetLanguageLabel: string;
  sourceLanguageLabel: string;
  contextLabel: string;
  speakLanguage: LanguageCode;
};

export function buildPartnerViewFromEntry(
  entry: ConversationEntry
): PartnerViewPayload | null {
  const translation =
    entry.polishedText?.trim() || entry.translatedText.trim();
  if (!translation) {
    return null;
  }

  const isMine = entry.direction === "speak";

  return {
    translation,
    original: entry.originalText?.trim() || undefined,
    targetLanguageLabel: getLanguageLabel(entry.targetLanguage),
    sourceLanguageLabel: getLanguageLabel(entry.sourceLanguage),
    contextLabel: isMine ? "상대에게 보여주세요" : "번역 내용",
    speakLanguage: entry.targetLanguage,
  };
}

export function buildPartnerViewFromLive(
  liveOriginal: string,
  liveTranslated: string,
  liveDirection: "listen" | "speak",
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode
): PartnerViewPayload | null {
  const translation = liveTranslated.trim();
  if (!translation) {
    return null;
  }

  const isMine = liveDirection === "speak";

  return {
    translation,
    original: liveOriginal.trim() || undefined,
    targetLanguageLabel: getLanguageLabel(targetLanguage),
    sourceLanguageLabel: getLanguageLabel(sourceLanguage),
    contextLabel: isMine ? "상대에게 보여주세요" : "번역 내용",
    speakLanguage: targetLanguage,
  };
}

export function findLatestPartnerFacingPayload(
  entries: ConversationEntry[],
  liveOriginal: string,
  liveTranslated: string,
  liveDirection: "listen" | "speak" | null,
  isActive: boolean,
  myLanguage: LanguageCode,
  partnerOutputLanguage: LanguageCode
): PartnerViewPayload | null {
  if (isActive && liveDirection === "speak") {
    const livePayload = buildPartnerViewFromLive(
      liveOriginal,
      liveTranslated,
      liveDirection,
      myLanguage,
      partnerOutputLanguage
    );
    if (livePayload) {
      return livePayload;
    }
  }

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry.direction !== "speak") {
      continue;
    }
    const payload = buildPartnerViewFromEntry(entry);
    if (payload) {
      return payload;
    }
  }

  return null;
}
