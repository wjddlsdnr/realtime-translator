"use client";

import type { PartnerViewPayload } from "@/lib/partnerView";
import { speakTranslatedText } from "@/lib/speechOutput";

type PartnerViewStripProps = {
  payload: PartnerViewPayload | null;
  active: boolean;
  onClose: () => void;
  onExpand: () => void;
};

export default function PartnerViewStrip({
  payload,
  active,
  onClose,
  onExpand,
}: PartnerViewStripProps) {
  if (!active) {
    return null;
  }

  return (
    <section className="partner-view-strip" aria-label="상대 보기">
      <div className="partner-view-strip-header">
        <span className="partner-view-strip-label">상대 보기</span>
        <div className="partner-view-strip-tools">
          {payload ? (
            <button
              type="button"
              className="partner-view-strip-tool"
              onClick={() =>
                speakTranslatedText(payload.translation, payload.speakLanguage)
              }
              aria-label="번역 듣기"
            >
              🔊
            </button>
          ) : null}
          <button
            type="button"
            className="partner-view-strip-tool"
            onClick={onClose}
            aria-label="상대 보기 끄기"
          >
            ✕
          </button>
        </div>
      </div>
      {payload ? (
        <button
          type="button"
          className="partner-view-strip-body"
          onClick={onExpand}
        >
          <p className="partner-view-strip-text">{payload.translation}</p>
          <span className="partner-view-strip-hint">탭하면 크게 보기</span>
        </button>
      ) : (
        <p className="partner-view-strip-empty">
          내가 말하면 상대에게 보여줄 번역이 여기에 크게 표시됩니다.
        </p>
      )}
    </section>
  );
}
