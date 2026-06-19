type OpenAiErrorPayload = {
  error?: {
    message?: string;
    code?: string;
    type?: string;
  };
};

/** OpenAI API 오류 응답을 사용자용 한국어 메시지로 변환합니다. */
export function toUserFriendlyOpenAiError(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as OpenAiErrorPayload;
    const message = parsed.error?.message ?? "";
    const code = parsed.error?.code ?? "";

    if (code === "rate_limit_exceeded" || message.includes("Rate limit")) {
      const waitMatch = message.match(/try again in (\d+m\d+s|\d+s)/i);
      const waitHint = waitMatch ? ` (약 ${waitMatch[1]} 후)` : "";

      return [
        "OpenAI 요청 한도(RPM)에 걸렸습니다.",
        `1분에 허용된 요청 수를 초과했습니다${waitHint}.`,
        "1~2분 기다린 뒤 '시작'을 한 번만 눌러 다시 시도해 주세요.",
        "반복해서 누르면 한도가 더 빨리 찹니다.",
        "한도를 늘리려면 OpenAI 결제 수단 등록이 필요할 수 있습니다.",
      ].join(" ");
    }

    if (message.includes("Failed to parse offer") || message.includes("unmarshal SDP")) {
      return [
        "WebRTC 연결 정보(SDP) 전달에 문제가 있었습니다.",
        "페이지를 새로고침한 뒤 다시 시도해 주세요.",
      ].join(" ");
    }

    if (message) {
      return message;
    }
  } catch {
    if (raw.includes("Failed to parse offer") || raw.includes("unmarshal SDP")) {
      return "WebRTC 연결 정보(SDP) 전달에 문제가 있었습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.";
    }
  }

  return raw;
}
