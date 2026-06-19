import type { SummaryResult } from "@/lib/types";

type SummaryPanelProps = {
  summary: SummaryResult | null;
  loading: boolean;
};

function ListSection({ title, items }: { title: string; items: string[] }) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="summary-block">
      <h3>{title}</h3>
      <ul>
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export default function SummaryPanel({ summary, loading }: SummaryPanelProps) {
  if (loading) {
    return (
      <section className="summary-panel">
        <h2>AI 요약</h2>
        <p className="loading-message">요약을 생성하는 중입니다...</p>
      </section>
    );
  }

  if (!summary) {
    return (
      <section className="summary-panel">
        <h2>AI 요약</h2>
        <p className="empty-message">미팅 종료 후 AI 요약을 생성할 수 있습니다.</p>
      </section>
    );
  }

  return (
    <section className="summary-panel">
      <h2>AI 요약</h2>

      <section className="summary-block">
        <h3>전체 요약</h3>
        <p>{summary.overallSummary}</p>
      </section>

      <ListSection title="핵심 논의 내용" items={summary.keyDiscussionPoints} />
      <ListSection title="결정된 사항" items={summary.decisions} />
      <ListSection title="해야 할 일 / Action Items" items={summary.actionItems} />
      <ListSection title="중요한 질문과 답변" items={summary.importantQandA} />
      <ListSection title="바이오/기술 관련 주요 용어" items={summary.bioTechTerms} />
      <ListSection title="후속 미팅에서 확인할 내용" items={summary.followUpItems} />

      <section className="summary-block">
        <h3>회의록 정리본</h3>
        <pre className="meeting-notes-draft">{summary.meetingNotesDraft}</pre>
      </section>
    </section>
  );
}
