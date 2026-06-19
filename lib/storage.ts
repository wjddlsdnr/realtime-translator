import type { ConversationEntry } from "./types";

const STORAGE_KEY = "realtime-translator-conversation-log";

/** 브라우저 localStorage에서 대화 기록을 불러옵니다. */
export function loadConversationLog(): ConversationEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as ConversationEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** 대화 기록 전체를 localStorage에 저장합니다. */
export function saveConversationLog(entries: ConversationEntry[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

/** 새 항목을 추가하고 저장합니다. */
export function appendConversationEntry(entry: ConversationEntry): ConversationEntry[] {
  const current = loadConversationLog();
  const next = [...current, entry];
  saveConversationLog(next);
  return next;
}

/** 항목의 다듬은 번역을 갱신합니다. */
export function updateConversationEntryPolished(
  entryId: string,
  polishedText: string
): ConversationEntry[] {
  const current = loadConversationLog();
  const next = current.map((entry) =>
    entry.id === entryId ? { ...entry, polishedText } : entry
  );
  saveConversationLog(next);
  return next;
}

/** 대화 기록을 초기화합니다. */
export function clearConversationLog(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}
