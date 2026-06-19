import type { LanguageCode } from "./types";

type PolishRequest = {
  originalText: string;
  translatedText: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
};

/** 서버에서 번역 초안을 자연스러운 문장으로 다듬습니다. */
export async function polishTranslation(
  request: PolishRequest
): Promise<string | null> {
  try {
    const response = await fetch("/api/polish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    const data = (await response.json()) as {
      polishedText?: string;
      error?: string;
    };

    if (!response.ok || !data.polishedText) {
      return null;
    }

    return data.polishedText;
  } catch {
    return null;
  }
}
