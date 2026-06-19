"use client";

import type { PartnerLanguageState } from "@/lib/partnerLanguage";
import type { ConnectionStatus } from "@/lib/types";
import { getLanguageLabel, type LanguageCode } from "@/lib/types";

type TravelStatusBarProps = {
  status: ConnectionStatus;
  myLanguage: LanguageCode;
  partnerLanguage: PartnerLanguageState | null;
  liveDetectedLabel: string | null;
  isActive: boolean;
};

function resolveStatusMessage(
  status: ConnectionStatus,
  isActive: boolean
): { message: string; active: boolean } {
  switch (status) {
    case "translating":
      return { message: "듣는 중 — 말씀해 주세요", active: true };
    case "requesting_mic":
      return { message: "마이크 준비 중…", active: true };
    case "creating_session":
    case "connecting":
      return { message: "연결 중…", active: true };
    case "error":
      return { message: "오류 — 다시 시작해 주세요", active: false };
    case "stopped":
      return { message: "정지됨", active: false };
    default:
      return isActive
        ? { message: "준비 중…", active: true }
        : { message: "시작을 눌러 통역을 시작하세요", active: false };
  }
}

export default function TravelStatusBar({
  status,
  myLanguage,
  partnerLanguage,
  liveDetectedLabel,
  isActive,
}: TravelStatusBarProps) {
  const { message, active } = resolveStatusMessage(status, isActive);
  const partnerLabel =
    partnerLanguage?.detectedLabel ?? liveDetectedLabel ?? null;

  return (
    <div className="travel-status-bar" role="status">
      <div className="travel-status-main">
        {active ? <span className="travel-status-pulse" aria-hidden /> : null}
        <span className="travel-status-message">{message}</span>
      </div>
      <div className="travel-status-langs">
        <span className="travel-lang-chip">내 언어 {getLanguageLabel(myLanguage)}</span>
        {partnerLabel ? (
          <span className="travel-lang-chip travel-lang-chip-partner">
            상대 {partnerLabel}
          </span>
        ) : isActive ? (
          <span className="travel-lang-chip travel-lang-chip-muted">상대 감지 중</span>
        ) : null}
      </div>
    </div>
  );
}
