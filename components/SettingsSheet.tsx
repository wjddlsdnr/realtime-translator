"use client";

import { useEffect, type ReactNode } from "react";

type SettingsSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

export default function SettingsSheet({
  open,
  onClose,
  title = "설정 및 도구",
  children,
}: SettingsSheetProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

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
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="settings-sheet-root" role="presentation">
      <button
        type="button"
        className="settings-sheet-backdrop"
        aria-label="닫기"
        onClick={onClose}
      />
      <div
        className="settings-sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-sheet-title"
      >
        <div className="settings-sheet-header">
          <h2 id="settings-sheet-title">{title}</h2>
          <button
            type="button"
            className="settings-sheet-close btn btn-outline btn-small"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
        <div className="settings-sheet-body">{children}</div>
      </div>
    </div>
  );
}
