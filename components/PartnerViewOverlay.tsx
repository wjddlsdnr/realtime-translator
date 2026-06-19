"use client";

import { useEffect } from "react";
import { speakTranslatedText } from "@/lib/speechOutput";
import type { PartnerViewPayload } from "@/lib/partnerView";

type PartnerViewOverlayProps = {
  payload: PartnerViewPayload;
  onClose: () => void;
};

export default function PartnerViewOverlay({
  payload,
  onClose,
}: PartnerViewOverlayProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const handleSpeak = () => {
    speakTranslatedText(payload.translation, payload.speakLanguage);
  };

  return (
    <div className="partner-view-root" role="presentation">
      <button
        type="button"
        className="partner-view-backdrop"
        aria-label="닫기"
        onClick={onClose}
      />
      <div
        className="partner-view-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="partner-view-title"
      >
        <p id="partner-view-title" className="partner-view-context">
          {payload.contextLabel}
        </p>
        <p className="partner-view-lang">
          {payload.sourceLanguageLabel} → {payload.targetLanguageLabel}
        </p>
        <p className="partner-view-text">{payload.translation}</p>
        {payload.original ? (
          <p className="partner-view-original">{payload.original}</p>
        ) : null}
        <div className="partner-view-actions">
          <button type="button" className="btn btn-outline" onClick={handleSpeak}>
            🔊 다시 듣기
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
