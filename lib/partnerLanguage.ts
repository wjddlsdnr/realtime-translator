import { DEFAULT_PARTNER_OUTPUT_LANGUAGE, type LanguageCode } from "./languages";
import type { ListeningMode } from "./sessionConfig";

const PARTNER_LANGUAGE_STORAGE_KEY = "realtime-translator-partner-language-v2";

export { DEFAULT_PARTNER_OUTPUT_LANGUAGE };

/** 상대방 언어를 모를 때 내 말의 기본 출력 언어 */
export const DEFAULT_PARTNER_OUTPUT = DEFAULT_PARTNER_OUTPUT_LANGUAGE;

export type PartnerLanguageState = {
  /** 내 말 → 상대에게 나갈 음성 출력 언어 (13개 중 하나) */
  outputLanguage: LanguageCode;
  /** AI가 인식한 상대방 언어 표시명 (예: Thai, English) */
  detectedLabel: string;
  /** franc ISO 639-3 (선택) */
  francCode?: string;
};

/** 현재 모드에서 Realtime 세션 출력 언어를 결정합니다. */
export function resolveSessionOutputLanguage(
  listeningMode: ListeningMode,
  myLanguage: LanguageCode,
  partner: PartnerLanguageState | null
): LanguageCode {
  if (listeningMode === "listen") {
    return myLanguage;
  }

  return resolvePartnerOutputLanguage(partner);
}

/** 상대방에게 나갈 출력 언어를 결정합니다. */
export function resolvePartnerOutputLanguage(
  partner: PartnerLanguageState | null
): LanguageCode {
  return partner?.outputLanguage ?? DEFAULT_PARTNER_OUTPUT_LANGUAGE;
}

/** 감지 결과로 상대방 언어 상태를 만듭니다. */
export function buildPartnerLanguageState(
  outputLanguage: LanguageCode | null,
  detectedLabel: string,
  francCode?: string
): PartnerLanguageState {
  return {
    outputLanguage: outputLanguage ?? DEFAULT_PARTNER_OUTPUT_LANGUAGE,
    detectedLabel,
    francCode,
  };
}

/** 내 언어와 다른 입력인지 판단합니다. */
export function shouldUpdatePartnerLanguage(
  outputCode: LanguageCode | null,
  detectedLabel: string,
  myLanguage: LanguageCode,
  isMine: boolean
): boolean {
  if (isMine) {
    return false;
  }

  if (outputCode && outputCode === myLanguage) {
    return false;
  }

  return Boolean(detectedLabel);
}

/** 저장된 상대방 언어를 불러옵니다. */
export function loadPartnerLanguage(): PartnerLanguageState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(PARTNER_LANGUAGE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as {
      outputLanguage?: LanguageCode;
      detectedLabel?: string;
      francCode?: string;
      language?: LanguageCode;
    };

    if (parsed.outputLanguage && parsed.detectedLabel) {
      return {
        outputLanguage: parsed.outputLanguage,
        detectedLabel: parsed.detectedLabel,
        francCode: parsed.francCode,
      };
    }

    if (parsed.language) {
      return {
        outputLanguage: parsed.language,
        detectedLabel: parsed.language,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/** 상대방 언어를 저장합니다. */
export function savePartnerLanguage(state: PartnerLanguageState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    PARTNER_LANGUAGE_STORAGE_KEY,
    JSON.stringify({ ...state, updatedAt: new Date().toISOString() })
  );
}

/** 상대방 언어를 초기화합니다. */
export function clearPartnerLanguage(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(PARTNER_LANGUAGE_STORAGE_KEY);
}
