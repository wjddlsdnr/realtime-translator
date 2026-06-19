/** 여러 transcript 조각 중 가장 완전한 문장을 고릅니다. */
export function mergeTranscriptParts(...parts: string[]): string {
  const segments = parts.map((part) => part.trim()).filter(Boolean);
  if (!segments.length) {
    return "";
  }

  let best = segments[0];
  for (const candidate of segments.slice(1)) {
    if (candidate === best) {
      continue;
    }
    if (candidate.includes(best)) {
      best = candidate;
      continue;
    }
    if (best.includes(candidate)) {
      continue;
    }
    if (candidate.length > best.length) {
      best = candidate;
    }
  }

  return best;
}
