"use client";

import dynamic from "next/dynamic";

const TranslatorPanel = dynamic(() => import("@/components/TranslatorPanel"), {
  ssr: false,
  loading: () => (
    <div className="app-layout">
      <div className="translator-main">
        <div className="translator-panel">
          <header className="app-header">
            <h1>실시간 음성 번역기</h1>
          </header>
          <p className="loading-message">불러오는 중…</p>
        </div>
      </div>
    </div>
  ),
});

export default function TranslatorPanelLoader() {
  return <TranslatorPanel />;
}
