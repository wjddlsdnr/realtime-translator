import {
  DEFAULT_PARTNER_OUTPUT_LANGUAGE,
  resolvePartnerOutputLanguage,
  type PartnerLanguageState,
} from "@/lib/partnerLanguage";
import type { SessionDirection, TranslationMode } from "@/lib/sessionConfig";
import { getLanguageLabel, type LanguageCode } from "@/lib/types";

type DetectedLanguageBadgeProps = {
  myLanguage: LanguageCode;
  partnerLanguage: PartnerLanguageState | null;
  liveDetectedLabel: string | null;
  translationMode: TranslationMode;
  activeDirection: SessionDirection;
  hasConfirmedSpeaker: boolean;
  isListening: boolean;
};

export default function DetectedLanguageBadge({
  myLanguage,
  partnerLanguage,
  liveDetectedLabel,
  translationMode,
  activeDirection,
  hasConfirmedSpeaker,
  isListening,
}: DetectedLanguageBadgeProps) {
  const outputForPartner = resolvePartnerOutputLanguage(partnerLanguage);
  const usingDefaultOutput =
    !partnerLanguage ||
    (partnerLanguage.outputLanguage === DEFAULT_PARTNER_OUTPUT_LANGUAGE &&
      partnerLanguage.detectedLabel !== "English");

  const partnerDisplayLabel =
    partnerLanguage?.detectedLabel ?? liveDetectedLabel;

  const outputNote =
    partnerLanguage &&
    partnerLanguage.outputLanguage !== partnerLanguage.detectedLabel &&
    !["English", "Korean", "Japanese", "Chinese", "Spanish", "Portuguese", "French", "German", "Russian", "Hindi", "Indonesian", "Vietnamese", "Italian"].includes(
      partnerLanguage.detectedLabel
    )
      ? ` (음성 출력: ${getLanguageLabel(partnerLanguage.outputLanguage)})`
      : usingDefaultOutput && activeDirection === "speak"
        ? " (기본)"
        : partnerLanguage
          ? " (자동 전환)"
          : "";

  return (
    <div className="language-status-block">
      <div className="language-status-row">
        <div className="language-status-chip language-status-mine">
          <span className="chip-label">내 언어 (내 화면)</span>
          <strong>{getLanguageLabel(myLanguage)}</strong>
        </div>
        <div className="language-status-chip language-status-detected">
          <span className="chip-label">AI 인식 상대방 언어</span>
          <strong>
            {partnerDisplayLabel
              ? partnerDisplayLabel
              : isListening && !hasConfirmedSpeaker
                ? "첫 음성 대기…"
                : isListening && activeDirection === "listen"
                  ? "감지 중…"
                  : "—"}
          </strong>
        </div>
        <div className="language-status-chip language-status-partner-output">
          <span className="chip-label">내 말 출력 언어</span>
          <strong>
            {getLanguageLabel(outputForPartner)}
            {outputNote}
          </strong>
        </div>
      </div>

      <p className="language-status-hint">
        {translationMode === "auto" ? (
          <>
            <strong>자동 모드</strong>:{" "}
            {!hasConfirmedSpeaker ? (
              <>첫 음성 언어로 내 말/상대 말을 결정합니다.</>
            ) : activeDirection === "listen" ? (
              <>
                상대방({partnerDisplayLabel ?? "외국어"}) →{" "}
                <strong>{getLanguageLabel(myLanguage)}</strong>
              </>
            ) : (
              <>
                내 말(<strong>{getLanguageLabel(myLanguage)}</strong>) →{" "}
                <strong>{getLanguageLabel(outputForPartner)}</strong>
                {!partnerLanguage
                  ? " (상대 언어 미감지, English 기본)"
                  : ""}
              </>
            )}
          </>
        ) : activeDirection === "listen" ? (
          <>
            상대방 말 → <strong>{getLanguageLabel(myLanguage)}</strong>
          </>
        ) : (
          <>
            내 말 → <strong>{getLanguageLabel(outputForPartner)}</strong>
          </>
        )}
      </p>
    </div>
  );
}
