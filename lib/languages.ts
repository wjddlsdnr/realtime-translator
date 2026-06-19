/** OpenAI gpt-realtime-translate 음성 출력 지원 언어 (13개) */
export const OUTPUT_LANGUAGE_CODES = [
  "en",
  "ko",
  "ja",
  "zh",
  "es",
  "pt",
  "fr",
  "de",
  "ru",
  "hi",
  "id",
  "vi",
  "it",
] as const;

export type LanguageCode = (typeof OUTPUT_LANGUAGE_CODES)[number];

export type Language = {
  code: LanguageCode;
  label: string;
};

export const LANGUAGES: Language[] = [
  { code: "en", label: "English" },
  { code: "ko", label: "Korean" },
  { code: "ja", label: "Japanese" },
  { code: "zh", label: "Chinese" },
  { code: "es", label: "Spanish" },
  { code: "pt", label: "Portuguese" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "ru", label: "Russian" },
  { code: "hi", label: "Hindi" },
  { code: "id", label: "Indonesian" },
  { code: "vi", label: "Vietnamese" },
  { code: "it", label: "Italian" },
];

const LANGUAGE_LABEL_MAP = Object.fromEntries(
  LANGUAGES.map((lang) => [lang.code, lang.label])
) as Record<LanguageCode, string>;

/** franc ISO 639-3 → 출력 언어 코드 */
export const FRANC_TO_LANGUAGE_CODE: Record<string, LanguageCode> = {
  eng: "en",
  kor: "ko",
  jpn: "ja",
  cmn: "zh",
  zho: "zh",
  spa: "es",
  por: "pt",
  fra: "fr",
  deu: "de",
  rus: "ru",
  hin: "hi",
  ind: "id",
  vie: "vi",
  ita: "it",
};

/** franc 코드 → 표시용 언어명 (주요 입력 언어) */
export const FRANC_LABELS: Record<string, string> = {
  eng: "English",
  kor: "Korean",
  jpn: "Japanese",
  cmn: "Chinese",
  zho: "Chinese",
  spa: "Spanish",
  por: "Portuguese",
  fra: "French",
  deu: "German",
  rus: "Russian",
  hin: "Hindi",
  ind: "Indonesian",
  vie: "Vietnamese",
  ita: "Italian",
  ara: "Arabic",
  tha: "Thai",
  tur: "Turkish",
  pol: "Polish",
  nld: "Dutch",
  swe: "Swedish",
  nor: "Norwegian",
  dan: "Danish",
  fin: "Finnish",
  ces: "Czech",
  ell: "Greek",
  heb: "Hebrew",
  ukr: "Ukrainian",
  ben: "Bengali",
  tam: "Tamil",
  tel: "Telugu",
  msa: "Malay",
  fil: "Filipino",
  swa: "Swahili",
};

export const DEFAULT_PARTNER_OUTPUT_LANGUAGE: LanguageCode = "en";

export function isSupportedOutputLanguage(code: string): code is LanguageCode {
  return (OUTPUT_LANGUAGE_CODES as readonly string[]).includes(code);
}

export function getLanguageLabel(code: LanguageCode): string {
  return LANGUAGE_LABEL_MAP[code] ?? code;
}

export function getFrancLabel(francCode: string): string {
  return FRANC_LABELS[francCode] ?? francCode.toUpperCase();
}

export function mapFrancToOutputLanguage(francCode: string): LanguageCode | null {
  return FRANC_TO_LANGUAGE_CODE[francCode] ?? null;
}
