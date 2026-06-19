"use client";

import type { ConversationThread } from "@/lib/threadStorage";

type ConversationSidebarProps = {
  threads: ConversationThread[];
  activeThreadId: string | null;
  isSessionActive: boolean;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
  onSaveCurrent: () => void;
  onRenameThread: (threadId: string, title: string) => void;
  onDeleteThread: (threadId: string) => void;
  mobileOpen: boolean;
  onToggleMobile: () => void;
  hideMobileToggle?: boolean;
};

function formatThreadMeta(thread: ConversationThread): string {
  const count = thread.entries.length;
  const date = new Date(thread.updatedAt).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${date} · ${count}개 메시지`;
}

export default function ConversationSidebar({
  threads,
  activeThreadId,
  isSessionActive,
  onSelectThread,
  onNewThread,
  onSaveCurrent,
  onRenameThread,
  onDeleteThread,
  mobileOpen,
  onToggleMobile,
  hideMobileToggle = false,
}: ConversationSidebarProps) {
  const handleRename = (thread: ConversationThread) => {
    const nextTitle = window.prompt("대화창 이름", thread.title);
    if (nextTitle === null) {
      return;
    }

    onRenameThread(thread.id, nextTitle);
  };

  const handleDelete = (thread: ConversationThread) => {
    if (
      !window.confirm(
        `"${thread.title}" 대화창을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`
      )
    ) {
      return;
    }

    onDeleteThread(thread.id);
  };

  return (
    <>
      {hideMobileToggle ? null : (
      <button
        type="button"
        className="sidebar-toggle btn btn-outline"
        onClick={onToggleMobile}
        aria-expanded={mobileOpen}
      >
        대화 목록
      </button>
      )}

      <aside
        className={`thread-sidebar ${mobileOpen ? "thread-sidebar-open" : ""}`}
        aria-label="저장된 대화창"
      >
        <div className="thread-sidebar-header">
          <h2>대화창</h2>
          <p className="thread-sidebar-hint">
            새 대화를 열면 다른 상대와의 통역으로 시작합니다.
          </p>
        </div>

        <div className="thread-sidebar-actions">
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={onNewThread}
            disabled={isSessionActive}
          >
            + 새 대화
          </button>
          <button
            type="button"
            className="btn btn-outline btn-block"
            onClick={onSaveCurrent}
          >
            이 대화 저장
          </button>
        </div>

        <ul className="thread-list">
          {threads.length === 0 ? (
            <li className="thread-empty">저장된 대화가 없습니다.</li>
          ) : (
            threads.map((thread) => {
              const isActive = thread.id === activeThreadId;

              return (
                <li key={thread.id}>
                  <button
                    type="button"
                    className={`thread-item ${isActive ? "thread-item-active" : ""}`}
                    onClick={() => onSelectThread(thread.id)}
                    disabled={isSessionActive && !isActive}
                  >
                    <span className="thread-item-title">{thread.title}</span>
                    <span className="thread-item-meta">
                      {formatThreadMeta(thread)}
                    </span>
                    {thread.partnerLanguage ? (
                      <span className="thread-item-partner">
                        상대: {thread.partnerLanguage.detectedLabel}
                      </span>
                    ) : null}
                  </button>
                  <div className="thread-item-tools">
                    <button
                      type="button"
                      className="thread-tool-btn"
                      onClick={() => handleRename(thread)}
                      aria-label="이름 변경"
                    >
                      이름
                    </button>
                    <button
                      type="button"
                      className="thread-tool-btn thread-tool-danger"
                      onClick={() => handleDelete(thread)}
                      aria-label="삭제"
                    >
                      삭제
                    </button>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </aside>

      {mobileOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={onToggleMobile}
          aria-label="사이드바 닫기"
        />
      ) : null}
    </>
  );
}
