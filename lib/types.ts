import type { LanguageCode } from "./languages";

export type ConnectionStatus =
  | "idle"
  | "requesting_mic"
  | "creating_session"
  | "connecting"
  | "translating"
  | "stopped"
  | "error";

export type TranslationDirection = "listen" | "speak";
export type MessageSpeaker = "user" | "partner";

export type ConversationEntry = {
  id: string;
  speaker: MessageSpeaker;
  timestamp: string;
  createdAt: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
  originalText: string;
  translatedText: string;
  polishedText?: string;
  direction: TranslationDirection;
  /** UI용 원문 언어 표시명 (예: Chinese, English) */
  sourceDisplayName?: string;
};

export type SummaryResult = {
  overallSummary: string;
  keyDiscussionPoints: string[];
  decisions: string[];
  actionItems: string[];
  importantQandA: string[];
  bioTechTerms: string[];
  followUpItems: string[];
  meetingNotesDraft: string;
};

export type RealtimeEvent = {
  type: string;
  delta?: string;
  transcript?: string;
  error?: {
    message?: string;
    code?: string;
  };
};

export type SessionResponse = {
  value?: string;
  client_secret?: {
    value: string;
    expires_at: number;
  };
  error?: {
    message?: string;
  };
};

export type SummaryRequestBody = {
  entries: ConversationEntry[];
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
};

export type SummaryApiResponse = {
  summary?: SummaryResult;
  error?: string;
};

/** 사용자 프로필 (v2: 내 언어 저장) */
export type UserProfile = {
  displayName: string;
  myLanguage: LanguageCode;
  createdAt: string;
  updatedAt: string;
};

export { getLanguageLabel, LANGUAGES, OUTPUT_LANGUAGE_CODES } from "./languages";
export type { Language, LanguageCode } from "./languages";
