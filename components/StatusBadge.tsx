import type { ConnectionStatus } from "@/lib/types";

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  idle: "대기 중",
  requesting_mic: "마이크 권한 요청 중",
  creating_session: "번역 세션 생성 중",
  connecting: "OpenAI 연결 중",
  translating: "번역 중",
  stopped: "정지됨",
  error: "오류 발생",
};

const STATUS_HINTS: Partial<Record<ConnectionStatus, string>> = {
  creating_session: "서버에서 임시 인증 정보를 받는 중입니다. 보통 1~3초 걸립니다.",
  connecting: "WebRTC로 OpenAI에 연결하는 중입니다. 10초 이상 걸리면 문제가 있는 것입니다.",
  translating: "연결 완료. 영어로 말하면 한국어 번역이 표시됩니다.",
};

type StatusBadgeProps = {
  status: ConnectionStatus;
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const hint = STATUS_HINTS[status];

  return (
    <div className="status-badge-wrap">
      <div className={`status-badge status-${status}`} role="status">
        {STATUS_LABELS[status]}
      </div>
      {hint ? <p className="status-hint">{hint}</p> : null}
    </div>
  );
}
