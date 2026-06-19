import type { LanguageCode } from "./languages";

const SPEECH_LOCALE: Record<LanguageCode, string> = {
  en: "en-US",
  ko: "ko-KR",
  ja: "ja-JP",
  zh: "zh-CN",
  es: "es-ES",
  pt: "pt-BR",
  fr: "fr-FR",
  de: "de-DE",
  ru: "ru-RU",
  hi: "hi-IN",
  id: "id-ID",
  vi: "vi-VN",
  it: "it-IT",
};

/** 내 발화 번역문을 브라우저 TTS로 읽습니다. (세션 출력은 내 언어 고정이라 echo 방지) */
export function speakTranslatedText(text: string, language: LanguageCode): void {
  if (typeof window === "undefined" || !text.trim()) {
    return;
  }

  const synth = window.speechSynthesis;
  if (!synth) {
    return;
  }

  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.lang = SPEECH_LOCALE[language] ?? language;
  synth.speak(utterance);
}

/** 진행 중 TTS를 중지합니다. */
export function stopSpeaking(): void {
  if (typeof window !== "undefined") {
    window.speechSynthesis?.cancel();
  }
}
