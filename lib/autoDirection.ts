import {
  getActiveSpeechText,
  inferInputLanguage,
  inferInputLanguageFast,
  isInputMyLanguage,
  type InferredInputLanguage,
} from "./detectLanguage";
import type { SessionDirection } from "./sessionConfig";
import type { LanguageCode } from "./languages";

/** 연속 전환 최소 간격 (대화 턴 전환용) */
export const DIRECTION_SWITCH_COOLDOWN_MS = 250;

/** 첫 화자 확정 전 최소 텍스트 길이 */
export const MIN_CHARS_FOR_FIRST_SPEAKER = 2;

/** 방향 전환 최소 텍스트 길이 */
export const MIN_CHARS_FOR_DIRECTION_SWITCH = 2;

/** 입력 언어로 화자 방향을 추정합니다. */
export function inferSpeakerDirection(
  inferred: InferredInputLanguage | null,
  myLanguage: LanguageCode
): SessionDirection | null {
  if (!inferred) {
    return null;
  }

  return isInputMyLanguage(inferred, myLanguage) ? "speak" : "listen";
}

/** 원문에서 말풍선 방향을 결정합니다. */
export function resolveDirectionForText(
  text: string,
  myLanguage: LanguageCode
): SessionDirection | null {
  const active = getActiveSpeechText(text);
  if (!active) {
    return null;
  }

  const inferred =
    inferInputLanguageFast(active, myLanguage) ??
    inferInputLanguage(active, myLanguage);
  return inferSpeakerDirection(inferred, myLanguage);
}

/** 자동 모드 부트스트랩 (첫 입력 전 임시 세션) */
export function getBootstrapSessionDirection(): SessionDirection {
  return "listen";
}

/** 원문 텍스트로 기록·표시에 쓸 방향을 결정합니다. */
export function resolveEntryDirection(
  originalText: string,
  myLanguage: LanguageCode,
  sessionDirection: SessionDirection,
  translationMode: "auto" | "manual"
): SessionDirection {
  if (translationMode !== "auto") {
    return sessionDirection;
  }

  return resolveDirectionForText(originalText, myLanguage) ?? sessionDirection;
}

/** 첫 발화 화자 방향 */
export function resolveFirstSpeakerDirection(
  inferred: InferredInputLanguage | null,
  myLanguage: LanguageCode,
  sourceText: string
): SessionDirection | null {
  if (!inferred || sourceText.trim().length < MIN_CHARS_FOR_FIRST_SPEAKER) {
    return null;
  }

  return inferSpeakerDirection(inferred, myLanguage);
}

/** 자동 모드: 입력 언어에 맞는 세션 방향 (매 발화마다 재평가) */
export function resolveAutoDirectionSwitch(
  inferred: InferredInputLanguage | null,
  myLanguage: LanguageCode,
  currentDirection: SessionDirection,
  sourceText: string,
  lastSwitchAt: number
): SessionDirection | null {
  if (!inferred) {
    return null;
  }

  const next = inferSpeakerDirection(inferred, myLanguage);
  if (!next || next === currentDirection) {
    return null;
  }

  if (sourceText.trim().length < MIN_CHARS_FOR_DIRECTION_SWITCH) {
    return null;
  }

  if (Date.now() - lastSwitchAt < DIRECTION_SWITCH_COOLDOWN_MS) {
    return null;
  }

  return next;
}
