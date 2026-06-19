"use client";

import { useEffect, useRef } from "react";
import { buildPartnerViewFromEntry } from "@/lib/partnerView";
import type { ConversationEntry } from "@/lib/types";
import { getLanguageLabel } from "@/lib/types";

type ChatConversationProps = {
  entries: ConversationEntry[];
  liveOriginal: string;
  liveTranslated: string;
  liveDirection: "listen" | "speak" | null;
  liveStartedAt: string | null;
  isActive: boolean;
  partnerViewPinned: boolean;
  onTogglePartnerView: () => void;
  onBubblePress?: (payload: ReturnType<typeof buildPartnerViewFromEntry>) => void;
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function ChatConversation({
  entries,
  liveOriginal,
  liveTranslated,
  liveDirection,
  liveStartedAt,
  isActive,
  partnerViewPinned,
  onTogglePartnerView,
  onBubblePress,
}: ChatConversationProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries, liveOriginal, liveTranslated]);

  const showLive =
    isActive && (liveOriginal.trim() || liveTranslated.trim()) && liveDirection;

  return (
    <section className="chat-section" aria-label="대화 기록">
      <div className="chat-header">
        <h2>대화</h2>
        <button
          type="button"
          className={`btn btn-outline btn-small chat-partner-toggle${
            partnerViewPinned ? " chat-partner-toggle-active" : ""
          }`}
          onClick={onTogglePartnerView}
          aria-pressed={partnerViewPinned}
        >
          상대 보기
        </button>
      </div>

      <div className="chat-thread">
        {entries.length === 0 && !showLive ? (
          <div className="chat-empty">
            <p className="chat-empty-lead">폰을 두 사람 사이에 두세요</p>
            <p className="chat-empty-body">
              시작을 누르면 말하는 언어를 자동으로 감지해 통역합니다.
            </p>
            <p className="chat-empty-sub">
              상대방은 왼쪽 · 내 말은 오른쪽 · 말풍선 탭하면 크게
            </p>
          </div>
        ) : null}

        {entries.map((entry) => {
          const isMine = entry.direction === "speak";
          const sourceLabel =
            entry.sourceDisplayName ??
            getLanguageLabel(entry.sourceLanguage);
          const targetLabel = getLanguageLabel(entry.targetLanguage);
          const translation =
            entry.polishedText?.trim() || entry.translatedText.trim();
          const partnerPayload = buildPartnerViewFromEntry(entry);

          return (
            <div
              key={entry.id}
              className={`chat-row ${isMine ? "chat-row-mine" : "chat-row-partner"}`}
            >
              <button
                type="button"
                className={`chat-bubble chat-bubble-button ${
                  isMine ? "chat-bubble-mine" : "chat-bubble-partner"
                }`}
                onClick={() => {
                  if (partnerPayload) {
                    onBubblePress?.(partnerPayload);
                  }
                }}
                disabled={!partnerPayload}
                aria-label={
                  partnerPayload
                    ? `${isMine ? "내" : "상대"} 말풍선 번역 크게 보기`
                    : undefined
                }
              >
                <span className="chat-speaker">{isMine ? "나" : "상대방"}</span>
                {entry.originalText ? (
                  <p className="chat-original">
                    <span className="chat-lang-tag">{sourceLabel}</span>
                    {entry.originalText}
                  </p>
                ) : null}
                {translation ? (
                  <p className="chat-translation">
                    <span className="chat-lang-tag chat-lang-tag-target">
                      {targetLabel}
                    </span>
                    {translation}
                  </p>
                ) : null}
                {partnerPayload ? (
                  <span className="chat-tap-hint">탭 → 크게 보기</span>
                ) : null}
                <time className="chat-time" dateTime={entry.timestamp} suppressHydrationWarning>
                  {formatTime(entry.timestamp)}
                </time>
              </button>
            </div>
          );
        })}

        {showLive ? (
          <div
            className={`chat-row ${
              liveDirection === "speak" ? "chat-row-mine" : "chat-row-partner"
            }`}
          >
            <div
              className={`chat-bubble chat-bubble-live ${
                liveDirection === "speak"
                  ? "chat-bubble-mine"
                  : "chat-bubble-partner"
              }`}
            >
              <span className="chat-speaker">
                {liveDirection === "speak" ? "나" : "상대방"}
                <span className="chat-live-dot" aria-hidden />
              </span>
              {liveOriginal ? (
                <p className="chat-original chat-text-live">{liveOriginal}</p>
              ) : (
                <p className="chat-typing">인식 중…</p>
              )}
              {liveTranslated ? (
                <p className="chat-translation chat-text-live">{liveTranslated}</p>
              ) : null}
              {liveStartedAt ? (
                <time className="chat-time" dateTime={liveStartedAt} suppressHydrationWarning>
                  {formatTime(liveStartedAt)}
                </time>
              ) : null}
            </div>
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>
    </section>
  );
}
