import type { ConversationEntry } from "@/lib/types";
import { getLanguageLabel } from "@/lib/types";

type ConversationLogProps = {
  entries: ConversationEntry[];
};

export default function ConversationLog({ entries }: ConversationLogProps) {
  return (
    <section className="conversation-log">
      <h2>대화 기록</h2>
      {entries.length === 0 ? (
        <p className="empty-message">아직 저장된 대화가 없습니다.</p>
      ) : (
        <ul className="conversation-list">
          {entries.map((entry) => (
            <li key={entry.id} className="conversation-item">
              <time dateTime={entry.timestamp}>
                {new Date(entry.timestamp).toLocaleString("ko-KR")}
                {" · "}
                {getLanguageLabel(entry.sourceLanguage)} →{" "}
                {getLanguageLabel(entry.targetLanguage)}
              </time>
              {entry.originalText ? (
                <p className="conversation-original">
                  <strong>원문:</strong> {entry.originalText}
                </p>
              ) : null}
              {entry.translatedText ? (
                <p className="conversation-translated">
                  <strong>번역:</strong>{" "}
                  {entry.polishedText ?? entry.translatedText}
                </p>
              ) : null}
              {entry.polishedText && entry.translatedText !== entry.polishedText ? (
                <p className="conversation-draft">
                  <strong>초안:</strong> {entry.translatedText}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
