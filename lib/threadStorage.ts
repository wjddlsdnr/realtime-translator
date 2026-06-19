import { createId } from "./id";
import type { PartnerLanguageState } from "./partnerLanguage";
import type { ConversationEntry, SummaryResult } from "./types";

const THREADS_STORAGE_KEY = "realtime-translator-threads-v2";
const ACTIVE_THREAD_STORAGE_KEY = "realtime-translator-active-thread-id-v2";
const LEGACY_LOG_KEY = "realtime-translator-conversation-log-v2";

export type ConversationThread = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  entries: ConversationEntry[];
  partnerLanguage: PartnerLanguageState | null;
  summary: SummaryResult | null;
};

function readThreads(): ConversationThread[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(THREADS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as ConversationThread[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeThreads(threads: ConversationThread[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(threads));
}

/** 스레드 제목을 첫 메시지 또는 날짜로 생성합니다. */
export function buildThreadTitle(
  entries: ConversationEntry[],
  createdAt: string
): string {
  const first = entries[0]?.originalText?.trim() || entries[0]?.translatedText?.trim();
  if (first) {
    const snippet = first.length > 24 ? `${first.slice(0, 24)}…` : first;
    return snippet;
  }

  return `대화 ${new Date(createdAt).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/** 저장된 대화창 목록을 불러옵니다. */
export function loadThreads(): ConversationThread[] {
  return readThreads().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/** 활성 대화창 ID를 불러옵니다. */
export function loadActiveThreadId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(ACTIVE_THREAD_STORAGE_KEY);
}

/** 활성 대화창 ID를 저장합니다. */
export function saveActiveThreadId(threadId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACTIVE_THREAD_STORAGE_KEY, threadId);
}

/** 새 빈 대화창을 만듭니다. */
export function createThread(title?: string): ConversationThread {
  const now = new Date().toISOString();
  const thread: ConversationThread = {
    id: createId(),
    title: title ?? buildThreadTitle([], now),
    createdAt: now,
    updatedAt: now,
    entries: [],
    partnerLanguage: null,
    summary: null,
  };

  const threads = readThreads();
  writeThreads([thread, ...threads]);
  saveActiveThreadId(thread.id);
  return thread;
}

/** 대화창을 저장·갱신합니다. */
export function upsertThread(thread: ConversationThread): ConversationThread[] {
  const threads = readThreads();
  const index = threads.findIndex((item) => item.id === thread.id);
  const nextThread = {
    ...thread,
    updatedAt: new Date().toISOString(),
    title:
      thread.title.trim() ||
      buildThreadTitle(thread.entries, thread.createdAt),
  };

  if (index === -1) {
    writeThreads([nextThread, ...threads]);
  } else {
    const next = [...threads];
    next[index] = nextThread;
    writeThreads(next);
  }

  return loadThreads();
}

/** ID로 대화창을 조회합니다. */
export function getThreadById(threadId: string): ConversationThread | null {
  return readThreads().find((thread) => thread.id === threadId) ?? null;
}

/** 대화창을 삭제합니다. */
export function deleteThread(threadId: string): ConversationThread[] {
  const next = readThreads().filter((thread) => thread.id !== threadId);
  writeThreads(next);

  if (loadActiveThreadId() === threadId) {
    if (next[0]) {
      saveActiveThreadId(next[0].id);
    } else {
      window.localStorage.removeItem(ACTIVE_THREAD_STORAGE_KEY);
    }
  }

  return loadThreads();
}

/** 대화창에 메시지를 추가합니다. */
export function appendEntryToThread(
  threadId: string,
  entry: ConversationEntry
): ConversationThread | null {
  const thread = getThreadById(threadId);
  if (!thread) {
    return null;
  }

  const entries = [...thread.entries, entry];
  const updated: ConversationThread = {
    ...thread,
    entries,
    title: buildThreadTitle(entries, thread.createdAt),
    updatedAt: new Date().toISOString(),
  };

  upsertThread(updated);
  return updated;
}

/** 원문 인식이 누락된 말풍선의 원문만 갱신합니다. */
export function updateThreadEntryOriginal(
  threadId: string,
  entryId: string,
  originalText: string
): ConversationThread | null {
  const thread = getThreadById(threadId);
  if (!thread) {
    return null;
  }

  const entries = thread.entries.map((entry) =>
    entry.id === entryId ? { ...entry, originalText } : entry
  );

  const updated: ConversationThread = {
    ...thread,
    entries,
    updatedAt: new Date().toISOString(),
  };

  upsertThread(updated);
  return updated;
}

/** 번역 비동기 완료 시 해당 말풍선의 번역문만 갱신합니다. */
export function updateThreadEntryTranslation(
  threadId: string,
  entryId: string,
  translatedText: string
): ConversationThread | null {
  const thread = getThreadById(threadId);
  if (!thread) {
    return null;
  }

  const entries = thread.entries.map((entry) =>
    entry.id === entryId ? { ...entry, translatedText } : entry
  );

  const updated: ConversationThread = {
    ...thread,
    entries,
    updatedAt: new Date().toISOString(),
  };

  upsertThread(updated);
  return updated;
}

/** 다듬은 번역을 갱신합니다. */
export function updateThreadEntryPolished(
  threadId: string,
  entryId: string,
  polishedText: string
): ConversationThread | null {
  const thread = getThreadById(threadId);
  if (!thread) {
    return null;
  }

  const entries = thread.entries.map((entry) =>
    entry.id === entryId ? { ...entry, polishedText } : entry
  );

  const updated: ConversationThread = {
    ...thread,
    entries,
    updatedAt: new Date().toISOString(),
  };

  upsertThread(updated);
  return updated;
}

/** 대화창 요약을 저장합니다. */
export function saveThreadSummary(
  threadId: string,
  summary: SummaryResult
): ConversationThread | null {
  const thread = getThreadById(threadId);
  if (!thread) {
    return null;
  }

  const updated: ConversationThread = {
    ...thread,
    summary,
    updatedAt: new Date().toISOString(),
  };

  upsertThread(updated);
  return updated;
}

/** 대화창 제목을 변경합니다. */
export function renameThread(
  threadId: string,
  title: string
): ConversationThread | null {
  const thread = getThreadById(threadId);
  if (!thread) {
    return null;
  }

  const updated: ConversationThread = {
    ...thread,
    title: title.trim() || thread.title,
    updatedAt: new Date().toISOString(),
  };

  upsertThread(updated);
  return updated;
}

/** 현재 대화창 내용만 비웁니다. */
export function clearThreadMessages(threadId: string): ConversationThread | null {
  const thread = getThreadById(threadId);
  if (!thread) {
    return null;
  }

  const updated: ConversationThread = {
    ...thread,
    entries: [],
    partnerLanguage: null,
    summary: null,
    title: buildThreadTitle([], thread.createdAt),
    updatedAt: new Date().toISOString(),
  };

  upsertThread(updated);
  return updated;
}

/** 예전 단일 기록 형식을 대화창으로 이전합니다. */
export function migrateLegacyConversationLog(): void {
  if (typeof window === "undefined") {
    return;
  }

  const existing = readThreads();
  if (existing.length > 0) {
    return;
  }

  try {
    const raw = window.localStorage.getItem(LEGACY_LOG_KEY);
    if (!raw) {
      return;
    }

    const entries = JSON.parse(raw) as ConversationEntry[];
    if (!Array.isArray(entries) || entries.length === 0) {
      window.localStorage.removeItem(LEGACY_LOG_KEY);
      return;
    }

    const now = new Date().toISOString();
    const thread: ConversationThread = {
      id: createId(),
      title: buildThreadTitle(entries, now),
      createdAt: now,
      updatedAt: now,
      entries,
      partnerLanguage: null,
      summary: null,
    };

    writeThreads([thread]);
    saveActiveThreadId(thread.id);
    window.localStorage.removeItem(LEGACY_LOG_KEY);
  } catch {
    window.localStorage.removeItem(LEGACY_LOG_KEY);
  }
}
