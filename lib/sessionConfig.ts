import type { LanguageCode } from "./types";

export type SessionDirection = "listen" | "speak";

/** @deprecated SessionDirection와 동일 — 세션별 실제 방향 */
export type ListeningMode = SessionDirection;

export type TranslationMode = "auto" | "manual";

type SessionAudioConfig = {
  input: {
    transcription: {
      model: string;
    };
    noise_reduction: {
      type: "near_field" | "far_field";
    };
  };
  output: {
    language: LanguageCode;
  };
};

/** 사용 모드에 맞는 OpenAI Realtime Translation 세션 오디오 설정을 만듭니다. */
export function buildSessionAudioConfig(
  targetLanguage: LanguageCode,
  sessionDirection: SessionDirection,
  translationMode: TranslationMode = "manual"
): SessionAudioConfig {
  // 자동(양방향) 모드는 본인 마이크에 가까이 말하는 경우가 대부분 → near_field
  // 수동 '상대방 듣기'만 far_field (멀리 있는 상대 음성)
  const useFarField =
    translationMode === "manual" && sessionDirection === "listen";

  return {
    input: {
      transcription: {
        model: "gpt-realtime-whisper",
      },
      noise_reduction: {
        type: useFarField ? "far_field" : "near_field",
      },
    },
    output: {
      language: targetLanguage,
    },
  };
}

/** 듣기/말하기 모드에 맞는 브라우저 마이크 설정을 반환합니다. */
export function getMicrophoneConstraints(
  sessionDirection: SessionDirection,
  translationMode: TranslationMode = "manual"
): MediaTrackConstraints {
  const useListenProfile =
    translationMode === "manual" && sessionDirection === "listen";

  if (useListenProfile) {
    return {
      echoCancellation: true,
      noiseSuppression: false,
      autoGainControl: true,
    };
  }

  // 자동(양방향): 폰·근거리 — trailing 음절(you 등)이 잘리지 않게 노이즈 억제 완화
  return {
    echoCancellation: true,
    noiseSuppression: false,
    autoGainControl: true,
  };
}
