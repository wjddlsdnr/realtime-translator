type TranscriptViewProps = {
  listeningMode: "listen" | "speak";
  sessionOriginal: string;
  sessionPolished: string;
  liveOriginal: string;
  liveTranslated: string;
  livePolished: string;
  isPolishing: boolean;
};

function combineText(sessionText: string, liveText: string): string {
  if (!sessionText) {
    return liveText;
  }
  if (!liveText) {
    return sessionText;
  }
  return `${sessionText}\n${liveText}`;
}

export default function TranscriptView({
  listeningMode,
  sessionOriginal,
  sessionPolished,
  liveOriginal,
  liveTranslated,
  livePolished,
  isPolishing,
}: TranscriptViewProps) {
  const originalText = combineText(sessionOriginal, liveOriginal);
  const polishedText = combineText(sessionPolished, livePolished);
  const hasDraftTranslation = Boolean(liveTranslated || sessionPolished);
  const originalHint =
    listeningMode === "listen"
      ? "상대방의 말이 여기에 표시됩니다."
      : "내가 말한 내용이 여기에 표시됩니다.";
  const polishedHint =
    listeningMode === "listen"
      ? "자연스럽게 다듬어진 번역(내 언어)이 여기에 표시됩니다."
      : "자연스럽게 다듬어진 번역(상대방 언어)이 여기에 표시됩니다.";

  return (
    <section className="transcript-section" aria-live="polite">
      <div className="transcript-card transcript-original">
        <h2>{listeningMode === "listen" ? "원문 자막 (상대방)" : "원문 자막 (내 말)"}</h2>
        <p>
          {originalText ||
            (hasDraftTranslation ? "원문 인식 중…" : originalHint)}
        </p>
      </div>

      {liveTranslated ? (
        <div className="transcript-card transcript-draft">
          <h2>실시간 번역 (초안)</h2>
          <p>{liveTranslated}</p>
        </div>
      ) : null}

      <div className="transcript-card transcript-translated">
        <h2>
          {listeningMode === "listen"
            ? "다듬은 번역 (내 언어)"
            : "다듬은 번역 (상대방 언어)"}
        </h2>
        <p>
          {polishedText ||
            (isPolishing ? "문장을 다듬는 중…" : polishedHint)}
        </p>
      </div>
    </section>
  );
}
