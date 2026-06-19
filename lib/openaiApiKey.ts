/** Vercel/로컬 env에 붙여넣기 실수(공백·중복)를 줄이기 위한 API 키 정규화 */
export function getOpenAIApiKey(): string | null {
  const raw = process.env.OPENAI_API_KEY?.trim();
  if (!raw) {
    return null;
  }

  let key = raw;

  if (key.startsWith("OPENAI_API_KEY=")) {
    key = key.slice("OPENAI_API_KEY=".length).trim();
  }

  // 실수로 키를 두 번 붙여넣은 경우 (sk-... sk-...)
  const firstToken = key.split(/\s+/)[0]?.trim();
  return firstToken || null;
}
