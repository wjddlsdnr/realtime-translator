import { franc } from "franc-min";
import {
  getFrancLabel,
  mapFrancToOutputLanguage,
  type LanguageCode,
} from "./languages";

export type InferredInputLanguage = {
  /** 출력 가능한 언어 코드 (13개 중 하나, 없으면 null) */
  outputCode: LanguageCode | null;
  /** franc ISO 639-3 */
  francCode: string;
  /** UI 표시용 언어명 */
  displayName: string;
};

type ScriptScores = {
  ko: number;
  ja: number;
  zh: number;
  latin: number;
};

function scoreScripts(text: string): ScriptScores {
  let ko = 0;
  let ja = 0;
  let zh = 0;
  let latin = 0;

  for (const char of text) {
    if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(char)) {
      ko += 2;
    } else if (/[\u3040-\u309F\u30A0-\u30FF]/.test(char)) {
      ja += 2;
    } else if (/[\u4E00-\u9FFF]/.test(char)) {
      zh += 1;
    } else if (/[A-Za-z]/.test(char)) {
      latin += 1;
    }
  }

  return { ko, ja, zh, latin };
}

type ScriptKind = "hangul" | "kana" | "han" | "latin" | "other";

export type ScriptRun = {
  text: string;
  script: ScriptKind;
};

/** 텍스트를 스크립트(언어) 구간별로 나눕니다. */
export function splitScriptRuns(text: string): ScriptRun[] {
  const runs: ScriptRun[] = [];
  let current = "";
  let currentScript: ScriptKind | null = null;

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed && currentScript && currentScript !== "other") {
      runs.push({ text: trimmed, script: currentScript });
    }
    current = "";
    currentScript = null;
  };

  for (const char of text) {
    let script: ScriptKind = "other";
    if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(char)) {
      script = "hangul";
    } else if (/[\u3040-\u309F\u30A0-\u30FF]/.test(char)) {
      script = "kana";
    } else if (/[\u4E00-\u9FFF]/.test(char)) {
      script = "han";
    } else if (/[A-Za-z]/.test(char)) {
      script = "latin";
    }

    if (script === "other") {
      if (currentScript && /\s/.test(char)) {
        current += char;
      }
      continue;
    }

    if (currentScript && script !== currentScript) {
      pushCurrent();
    }

    currentScript = script;
    current += char;
  }

  pushCurrent();
  return runs;
}

/** 여러 언어가 섞였는지 확인합니다. */
export function hasMultipleLanguageRuns(text: string): boolean {
  const scripts = new Set(
    splitScriptRuns(text)
      .map((run) => run.script)
      .filter((script) => script !== "other")
  );
  return scripts.size > 1;
}

/** 현재 말하고 있는(마지막) 언어 구간만 반환합니다. */
export function getTrailingSpeechSegment(text: string): string {
  const runs = splitScriptRuns(text);
  if (!runs.length) {
    return text.trim();
  }
  return runs[runs.length - 1].text;
}

/** 방향·표시용 활성 구간 (여러 언어가 섞이면 마지막 구간) */
export function getActiveSpeechText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }
  if (hasMultipleLanguageRuns(trimmed)) {
    return getTrailingSpeechSegment(trimmed);
  }
  return trimmed;
}

function buildInferred(
  output: LanguageCode,
  francCode: string
): InferredInputLanguage {
  return {
    outputCode: output,
    francCode,
    displayName: getFrancLabel(francCode),
  };
}

/** 스크립트 기반 즉시 언어 추정 (짧은 발화·전환용) */
export function inferInputLanguageFast(
  text: string,
  myLanguage: LanguageCode
): InferredInputLanguage | null {
  const active = getActiveSpeechText(text);
  if (!active) {
    return null;
  }

  return inferInputLanguageFastSingle(active, myLanguage);
}

function inferInputLanguageFastSingle(
  text: string,
  myLanguage: LanguageCode
): InferredInputLanguage | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const scores = scoreScripts(trimmed);
  const hasKo = scores.ko > 0;
  const hasJa = scores.ja > 0;
  const hasZh = scores.zh > 0;
  const hasLatin = scores.latin > 0;

  if (hasKo && hasLatin && scores.ko >= scores.latin) {
    return buildInferred("ko", "kor");
  }
  if (hasKo && hasLatin) {
    return buildInferred("en", "eng");
  }

  if (hasJa && hasZh) {
    if (scores.ja >= scores.zh) {
      return buildInferred("ja", "jpn");
    }
    return buildInferred("zh", "cmn");
  }

  if (myLanguage === "ja" && hasJa) {
    return buildInferred("ja", "jpn");
  }
  if (myLanguage === "zh" && hasZh && !hasJa) {
    return buildInferred("zh", "cmn");
  }
  if (myLanguage === "ko" && hasKo) {
    return buildInferred("ko", "kor");
  }

  if (hasZh && myLanguage !== "zh") {
    return buildInferred("zh", "cmn");
  }
  if (hasJa && myLanguage !== "ja") {
    return buildInferred("ja", "jpn");
  }
  if (hasKo && myLanguage !== "ko") {
    return buildInferred("ko", "kor");
  }

  if (myLanguage === "en" && hasLatin && !hasKo && !hasJa && !hasZh) {
    return buildInferred("en", "eng");
  }
  if (hasLatin && !hasKo && !hasJa && !hasZh) {
    return buildInferred("en", "eng");
  }

  return null;
}

/** 원문 텍스트에서 입력 언어를 추정합니다. */
export function inferInputLanguage(
  text: string,
  myLanguage?: LanguageCode
): InferredInputLanguage | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  if (myLanguage) {
    const fast = inferInputLanguageFast(trimmed, myLanguage);
    if (fast) {
      return fast;
    }
  }

  const francCode = franc(trimmed, { minLength: 3 });
  if (francCode === "und") {
    return inferFromScriptFallback(trimmed);
  }

  return {
    outputCode: mapFrancToOutputLanguage(francCode),
    francCode,
    displayName: getFrancLabel(francCode),
  };
}

/** franc가 짧은 텍스트에서 und일 때 스크립트 기반 보조 추정 */
function inferFromScriptFallback(text: string): InferredInputLanguage | null {
  const scores = scoreScripts(text);

  const ranked = [
    { code: "kor" as const, output: "ko" as LanguageCode, score: scores.ko },
    { code: "jpn" as const, output: "ja" as LanguageCode, score: scores.ja },
    { code: "cmn" as const, output: "zh" as LanguageCode, score: scores.zh },
    { code: "eng" as const, output: "en" as LanguageCode, score: scores.latin },
  ]
    .filter((item) => item.score >= 1)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) {
    return null;
  }

  const top = ranked[0];
  return {
    outputCode: top.output,
    francCode: top.code,
    displayName: getFrancLabel(top.code),
  };
}

/** 기존 호출부 호환: 출력 언어 코드만 반환 */
export function inferLanguageFromText(text: string): LanguageCode | null {
  return inferInputLanguage(text)?.outputCode ?? null;
}

/** 프로필 언어와 같은 입력인지 판단합니다. */
export function isInputMyLanguage(
  inferred: InferredInputLanguage | null,
  myLanguage: LanguageCode
): boolean {
  if (!inferred) {
    return false;
  }

  if (inferred.outputCode === myLanguage) {
    return true;
  }

  return mapFrancToOutputLanguage(inferred.francCode) === myLanguage;
}
