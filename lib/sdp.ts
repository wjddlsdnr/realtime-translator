/** SDP 문자열을 OpenAI가 기대하는 CRLF 형식으로 정규화합니다. */
export function normalizeSdp(sdp: string): string {
  const trimmed = sdp.trim();
  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
  return normalized.endsWith("\r\n") ? normalized : `${normalized}\r\n`;
}

/** 유효한 WebRTC offer SDP인지 검사합니다. */
export function isValidOfferSdp(sdp: string): boolean {
  const normalized = normalizeSdp(sdp);
  return (
    normalized.startsWith("v=0\r\n") &&
    normalized.includes("m=audio") &&
    normalized.length > 50
  );
}
