import type { ConversationEntry } from "./types";

/** 대화 기록을 JSON 파일로 다운로드합니다. */
export function downloadConversationAsJson(entries: ConversationEntry[]): void {
  const blob = new Blob([JSON.stringify(entries, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  triggerDownload(blob, `conversation-${timestampLabel()}.json`);
}

/** 대화 기록을 읽기 쉬운 텍스트 파일로 다운로드합니다. */
export function downloadConversationAsText(entries: ConversationEntry[]): void {
  const lines = entries.map((entry) => {
    const time = new Date(entry.timestamp).toLocaleString("ko-KR");
    return [
      `[${time}]`,
      `원문 (${entry.sourceLanguage}): ${entry.originalText}`,
      `번역 (${entry.targetLanguage}): ${entry.translatedText}`,
      "",
    ].join("\n");
  });

  const blob = new Blob([lines.join("\n")], {
    type: "text/plain;charset=utf-8",
  });
  triggerDownload(blob, `conversation-${timestampLabel()}.txt`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function timestampLabel(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
