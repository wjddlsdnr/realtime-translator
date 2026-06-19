import type { ConversationEntry } from "./types";

/** AI 요약 생성에 사용할 시스템 프롬프트 */
export const SUMMARY_SYSTEM_PROMPT = `당신은 국제 미팅, 바이오/기술 회의, 해외 여행 상담 등의 대화 기록을 정리하는 전문 회의록 작성자입니다.
사용자가 제공한 대화 기록을 바탕으로 정확하고 실용적인 요약을 JSON 형식으로 작성하세요.
추측하지 말고, 기록에 없는 내용은 "기록에 없음"으로 표시하세요.
바이오/기술 용어가 있으면 원문과 함께 간단히 설명하세요.
응답은 반드시 아래 JSON 스키마만 포함해야 합니다:

{
  "overallSummary": "string",
  "keyDiscussionPoints": ["string"],
  "decisions": ["string"],
  "actionItems": ["string"],
  "importantQandA": ["string"],
  "bioTechTerms": ["string"],
  "followUpItems": ["string"],
  "meetingNotesDraft": "string"
}`;

/** 대화 기록을 요약 API에 보낼 사용자 프롬프트로 변환합니다. */
export function buildSummaryUserPrompt(
  entries: ConversationEntry[],
  sourceLanguage: string,
  targetLanguage: string
): string {
  const transcript = entries
    .map((entry, index) => {
      return [
        `# 발화 ${index + 1}`,
        `시간: ${entry.timestamp}`,
        `원문: ${entry.originalText}`,
        `번역: ${entry.translatedText}`,
      ].join("\n");
    })
    .join("\n\n");

  return [
    "다음은 실시간 음성 번역으로 기록된 대화입니다.",
    `입력 언어: ${sourceLanguage}`,
    `출력 언어: ${targetLanguage}`,
    "",
    transcript || "(기록 없음)",
    "",
    "위 대화를 바탕으로 요약 JSON을 생성하세요.",
  ].join("\n");
}
