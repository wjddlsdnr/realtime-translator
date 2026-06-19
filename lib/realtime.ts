import { resolveDirectionForText } from "./autoDirection";
import { createId } from "./id";
import {
  getActiveSpeechText,
  hasMultipleLanguageRuns,
  inferInputLanguage,
  inferInputLanguageFast,
  isInputMyLanguage,
  splitScriptRuns,
  type InferredInputLanguage,
} from "./detectLanguage";
import { DEFAULT_PARTNER_OUTPUT_LANGUAGE } from "./languages";
import {
  getMicrophoneConstraints,
  type ListeningMode,
  type TranslationMode,
} from "./sessionConfig";
import { isValidOfferSdp, normalizeSdp } from "./sdp";
import type {
  ConnectionStatus,
  ConversationEntry,
  LanguageCode,
  RealtimeEvent,
} from "./types";

const CONNECTION_TIMEOUT_MS = 60_000;
/** 발화 끝 침묵 감지 (짧으면 빠른 말이 잘립니다) */
const SILENCE_COMMIT_MS = 4_000;
/** input_transcript.done 이후 추가 대기 (원문 세그먼트 완료·뒤따르는 단어) */
const DONE_COMMIT_MS = 1_700;
/** done 시점에 단어가 하나뿐이면 (예: thank → thank you) 추가 대기 */
const SHORT_UTTERANCE_EXTRA_MS = 900;
/** session.update 재전송 최소 간격 (너무 자주 보내면 스트림이 끊길 수 있음) */
const REFRESH_INPUT_MIN_INTERVAL_MS = 3_000;

function inputNoiseReductionType(
  translationMode: TranslationMode,
  listeningMode: ListeningMode
): "near_field" | "far_field" {
  return translationMode === "manual" && listeningMode === "listen"
    ? "far_field"
    : "near_field";
}

/** ICE 수집 완료 후 local SDP offer를 반환합니다. */
async function createLocalOfferSdp(
  peerConnection: RTCPeerConnection
): Promise<string> {
  const offer = await peerConnection.createOffer({
    offerToReceiveAudio: true,
  });
  await peerConnection.setLocalDescription(offer);

  await new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      peerConnection.onicecandidate = null;
      if (isValidOfferSdp(peerConnection.localDescription?.sdp ?? "")) {
        resolve();
        return;
      }
      reject(new Error("ICE gathering timeout"));
    }, 10_000);

    peerConnection.onicecandidate = (event) => {
      if (event.candidate === null) {
        window.clearTimeout(timeoutId);
        peerConnection.onicecandidate = null;
        resolve();
      }
    };
  });

  const sdp = normalizeSdp(peerConnection.localDescription?.sdp ?? "");
  if (!isValidOfferSdp(sdp)) {
    throw new Error("WebRTC offer SDP를 생성하지 못했습니다.");
  }

  return sdp;
}

/** fetch 요청에 타임아웃을 적용합니다. */
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function getMicrophoneErrorMessage(): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return (
      "마이크는 HTTPS(보안 연결)에서만 사용할 수 있습니다. " +
      "http://192.168... 같은 주소로는 iPhone에서 마이크가 차단됩니다. " +
      "PC에서는 localhost로, 폰 테스트는 npm run dev:https 또는 Vercel 배포(HTTPS)를 사용해 주세요."
    );
  }

  if (typeof navigator !== "undefined" && !navigator.mediaDevices?.getUserMedia) {
    return "이 브라우저/접속 방식에서는 마이크 API를 사용할 수 없습니다. HTTPS로 접속해 주세요.";
  }

  return "마이크 권한이 필요합니다. Safari에서 이 사이트에 대한 마이크 허용을 확인해 주세요.";
}

export type RealtimeSessionConfig = {
  targetLanguage: LanguageCode;
  myLanguage: LanguageCode;
  partnerOutputLanguage?: LanguageCode;
  listeningMode?: ListeningMode;
  translationMode?: TranslationMode;
  /** 방향 전환 시 마이크를 다시 열지 않고 기존 스트림을 재사용합니다. */
  existingMediaStream?: MediaStream;
  onStatusChange: (status: ConnectionStatus) => void;
  onError: (message: string) => void;
  onInputLanguageDetected?: (
    inferred: InferredInputLanguage,
    sourceText: string
  ) => void;
  /** 새 발화의 첫 글자에서 언어가 감지되면 호출 (방향 선제 전환용) */
  onUtteranceLanguageDetected?: (
    inferred: InferredInputLanguage,
    sourceText: string
  ) => void;
  /** 새 발화가 시작될 때 호출 (UI 초기화용) */
  onUtteranceStart?: () => void;
  /** 잘못된 세션 모드로 번역이 불가능할 때 (기록 생략) */
  onSkippedUtterance?: (originalText: string) => void;
  /** 현재 세션 방향과 실제 화자가 다를 때 (세션 전환·기록용) */
  onModeMismatchUtterance?: (
    originalText: string,
    translatedText: string,
    textDirection: ListeningMode
  ) => void;
  onOriginalDelta: (delta: string) => void;
  onTranslatedDelta: (delta: string) => void;
  onOriginalSegment?: (text: string) => void;
  onTranslatedSegment?: (text: string) => void;
  onMediaStreamReady?: (stream: MediaStream) => void;
  onEntryCommitted: (entry: ConversationEntry) => void;
};

export type RealtimeSessionHandle = {
  stop: (options?: {
    keepMediaStream?: boolean;
    skipStatusUpdate?: boolean;
    discardBuffers?: boolean;
  }) => Promise<void>;
};

type TranscriptBuffers = {
  original: string;
  translated: string;
  inputDone: boolean;
  outputDone: boolean;
  /** delta/done 중 가장 긴 원문 (앞·뒤 잘림 방지) */
  peakOriginal: string;
  /** delta/done 중 가장 긴 번역문 */
  peakTranslated: string;
};

function pickLongerText(a: string, b: string): string {
  const left = a.trim();
  const right = b.trim();
  return left.length >= right.length ? left : right;
}

function resolveOriginalText(buffers: TranscriptBuffers): string {
  return pickLongerText(buffers.original, buffers.peakOriginal);
}

function resolveTranslatedText(buffers: TranscriptBuffers): string {
  return pickLongerText(buffers.translated, buffers.peakTranslated);
}

function syncPeakOriginal(buffers: TranscriptBuffers): void {
  buffers.peakOriginal = pickLongerText(buffers.original, buffers.peakOriginal);
}

function syncPeakTranslated(buffers: TranscriptBuffers): void {
  buffers.peakTranslated = pickLongerText(
    buffers.translated,
    buffers.peakTranslated
  );
}

function runsCrossLanguageBoundary(runs: ReturnType<typeof splitScriptRuns>): boolean {
  if (runs.length < 2) {
    return false;
  }
  const scripts = new Set(runs.map((run) => run.script));
  if (scripts.has("hangul") && scripts.has("latin")) {
    return true;
  }
  if (scripts.has("latin") && (scripts.has("kana") || scripts.has("han"))) {
    return true;
  }
  if (scripts.has("hangul") && scripts.has("kana")) {
    return true;
  }
  return false;
}

/** OpenAI Realtime Translation WebRTC 세션을 생성하고 관리합니다. */
export async function startRealtimeTranslation(
  config: RealtimeSessionConfig
): Promise<RealtimeSessionHandle> {
  const {
    targetLanguage,
    myLanguage,
    partnerOutputLanguage,
    listeningMode = "listen",
    translationMode = "manual",
    onStatusChange,
    onError,
    onInputLanguageDetected,
    onUtteranceLanguageDetected,
    onUtteranceStart,
    onSkippedUtterance,
    onModeMismatchUtterance,
    onOriginalDelta,
    onTranslatedDelta,
    onOriginalSegment,
    onTranslatedSegment,
    onMediaStreamReady,
    onEntryCommitted,
    existingMediaStream,
  } = config;

  let mediaStream: MediaStream;
  const reusedStream =
    existingMediaStream &&
    existingMediaStream.getAudioTracks().some((track) => track.readyState === "live");

  if (reusedStream) {
    mediaStream = existingMediaStream;
    onMediaStreamReady?.(mediaStream);
  } else {
    onStatusChange("requesting_mic");

    if (typeof window !== "undefined" && !window.isSecureContext) {
      onStatusChange("error");
      onError(getMicrophoneErrorMessage());
      throw new Error("Insecure context");
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      onStatusChange("error");
      onError(getMicrophoneErrorMessage());
      throw new Error("MediaDevices unavailable");
    }

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: getMicrophoneConstraints(listeningMode, translationMode),
      });
    } catch {
      onStatusChange("error");
      onError(getMicrophoneErrorMessage());
      throw new Error("Microphone permission denied");
    }

    onMediaStreamReady?.(mediaStream);
  }

  onStatusChange("creating_session");

  const peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });
  const audioElement = new Audio();
  audioElement.autoplay = true;

  let dataChannel: RTCDataChannel | undefined;

  try {
    const audioTrack = mediaStream.getAudioTracks()[0];
    if (audioTrack) {
      peerConnection.addTrack(audioTrack, mediaStream);
    }

    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        audioElement.srcObject = remoteStream;
        void audioElement.play().catch(() => {
          onError(
            "번역 음성 재생에 실패했습니다. 화면을 한 번 터치한 뒤 다시 시도해 주세요."
          );
        });
      }
    };

    dataChannel = peerConnection.createDataChannel("oai-events");
    const buffers: TranscriptBuffers = {
      original: "",
      translated: "",
      inputDone: false,
      outputDone: false,
      peakOriginal: "",
      peakTranslated: "",
    };
    let commitTimer: ReturnType<typeof setTimeout> | null = null;
    let doneTimer: ReturnType<typeof setTimeout> | null = null;
    let detectedSourceLanguage: LanguageCode | null = null;
    let utteranceLanguageCode: LanguageCode | null = null;
    let lastInputRefreshAt = 0;

    const syncRemoteAudioMute = (referenceText: string) => {
      const trimmed = referenceText.trim();
      if (!trimmed) {
        audioElement.muted = false;
        return;
      }
      const direction = resolveDirectionForText(trimmed, myLanguage);
      // 내 언어 발화는 세션이 같은 언어 echo를 재생하므로 음소거합니다.
      audioElement.muted = direction === "speak";
    };

    const clearCommitTimers = () => {
      if (commitTimer) {
        clearTimeout(commitTimer);
        commitTimer = null;
      }
      if (doneTimer) {
        clearTimeout(doneTimer);
        doneTimer = null;
      }
    };

    const refreshInputTranscription = (force = false) => {
      if (dataChannel?.readyState !== "open") {
        return;
      }
      const now = Date.now();
      if (!force && now - lastInputRefreshAt < REFRESH_INPUT_MIN_INTERVAL_MS) {
        return;
      }
      lastInputRefreshAt = now;
      dataChannel.send(
        JSON.stringify({
          type: "session.update",
          session: {
            audio: {
              input: {
                transcription: { model: "gpt-realtime-whisper" },
                noise_reduction: {
                  type: inputNoiseReductionType(translationMode, listeningMode),
                },
              },
            },
          },
        })
      );
    };

    const resetAfterCommit = () => {
      utteranceLanguageCode = null;
      refreshInputTranscription(true);
    };

    const checkLanguageBoundary = (
      buffers: TranscriptBuffers,
      utteranceStart: boolean
    ) => {
      if (utteranceStart) {
        utteranceLanguageCode = null;
        return;
      }

      const inferred = inferInputLanguageFast(buffers.original, myLanguage);
      if (!inferred?.outputCode) {
        return;
      }

      if (
        utteranceLanguageCode &&
        inferred.outputCode !== utteranceLanguageCode &&
        hasMultipleLanguageRuns(buffers.original)
      ) {
        const runs = splitScriptRuns(buffers.original);
        if (runsCrossLanguageBoundary(runs) && runs.length >= 2) {
          const previousText = runs
            .slice(0, -1)
            .map((run) => run.text)
            .join(" ")
            .trim();
          const trailingText = runs[runs.length - 1]?.text.trim() ?? "";

          if (previousText.length >= 12 && trailingText.length >= 4) {
            const previousBuffers: TranscriptBuffers = {
              original: previousText,
              translated: buffers.translated,
              inputDone: true,
              outputDone: buffers.outputDone,
              peakOriginal: previousText,
              peakTranslated: buffers.peakTranslated,
            };
            commitEntry(previousBuffers, utteranceLanguageCode, { force: true });
          }

          buffers.original = trailingText;
          buffers.peakOriginal = trailingText;
          buffers.translated = "";
          buffers.peakTranslated = "";
          buffers.inputDone = false;
          buffers.outputDone = false;
          clearCommitTimers();
          onUtteranceStart?.();
          onUtteranceLanguageDetected?.(inferred, trailingText);
        }
      }

      utteranceLanguageCode = inferred.outputCode;
    };

    const notifyLanguage = (text: string, utteranceStart: boolean) => {
      const active = getActiveSpeechText(text);
      if (!active) {
        return;
      }

      const fast = inferInputLanguageFast(active, myLanguage);
      const minLength = fast ? 1 : 2;
      const inferred =
        fast ??
        (active.length >= minLength ? inferInputLanguage(active, myLanguage) : null);
      if (!inferred) {
        return;
      }

      if (
        inferred.outputCode &&
        inferred.outputCode !== detectedSourceLanguage
      ) {
        detectedSourceLanguage = inferred.outputCode;
      }

      if (translationMode === "auto") {
        onInputLanguageDetected?.(inferred, active);
        if (utteranceStart) {
          onUtteranceLanguageDetected?.(inferred, active);
        }
      } else if (listeningMode === "listen") {
        onInputLanguageDetected?.(inferred, active);
      }
    };

    const updateDetectedFromText = (text: string, utteranceStart = false) => {
      notifyLanguage(text, utteranceStart);
    };

    const commitEntry = (
      buffers: TranscriptBuffers,
      detected: LanguageCode | null,
      options?: { force?: boolean }
    ) => {
      clearCommitTimers();
      commitSegmentIfReady(
        buffers,
        {
          listeningMode,
          translationMode,
          myLanguage,
          detectedSourceLanguage: detected,
          outputLanguage: targetLanguage,
          partnerOutputLanguage:
            partnerOutputLanguage ?? DEFAULT_PARTNER_OUTPUT_LANGUAGE,
        },
        onEntryCommitted,
        options,
        resetAfterCommit
      );
    };

    const scheduleCommit = () => {
      if (commitTimer) {
        clearTimeout(commitTimer);
      }
      commitTimer = setTimeout(() => {
        commitTimer = null;
        commitEntry(buffers, detectedSourceLanguage, { force: true });
      }, SILENCE_COMMIT_MS);
    };

    const scheduleDoneCommit = () => {
      if (doneTimer) {
        clearTimeout(doneTimer);
      }
      const text = buffers.original.trim();
      const wordCount = text ? text.split(/\s+/).length : 0;
      const delay =
        DONE_COMMIT_MS +
        (wordCount === 1 && text.length <= 14 ? SHORT_UTTERANCE_EXTRA_MS : 0);
      doneTimer = setTimeout(() => {
        doneTimer = null;
        commitEntry(buffers, detectedSourceLanguage, { force: true });
      }, delay);
    };

    dataChannel.onopen = () => {
      dataChannel?.send(
        JSON.stringify({
          type: "session.update",
          session: {
            audio: {
              input: {
                transcription: { model: "gpt-realtime-whisper" },
                noise_reduction: {
                  type: inputNoiseReductionType(translationMode, listeningMode),
                },
              },
            },
          },
        })
      );
    };

    dataChannel.onmessage = (messageEvent) => {
      try {
        const event = JSON.parse(String(messageEvent.data)) as RealtimeEvent;
        handleRealtimeEvent(event, {
          buffers,
          listeningMode,
          translationMode,
          myLanguage,
          getDetectedSourceLanguage: () => detectedSourceLanguage,
          outputLanguage: targetLanguage,
          onOriginalDelta,
          onTranslatedDelta,
          onOriginalSegment,
          onTranslatedSegment,
          onUtteranceStart,
          onSkippedUtterance,
          onModeMismatchUtterance,
          onEntryCommitted,
          onError,
          scheduleCommit,
          scheduleDoneCommit,
          updateDetectedFromText,
          commitEntry,
          clearCommitTimers,
          checkLanguageBoundary,
          syncRemoteAudioMute,
          refreshInputTranscription,
          onOutputUtteranceStart: () => {
            // 번역이 먼저 도착하면 상대방 발화로 가정 (이전 감지 ko 등 stale 방지)
            detectedSourceLanguage =
              partnerOutputLanguage ?? DEFAULT_PARTNER_OUTPUT_LANGUAGE;
          },
        });
      } catch {
        onError("번역 이벤트를 처리하는 중 오류가 발생했습니다.");
      }
    };

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === "connected") {
        onStatusChange("translating");
      }
      if (peerConnection.connectionState === "failed") {
        onStatusChange("error");
        onError(
          "WebRTC 연결에 실패했습니다. 네트워크를 확인하고 다시 시도해 주세요."
        );
      }
    };

    onStatusChange("connecting");

    const localSdp = await createLocalOfferSdp(peerConnection);

    let connectResponse: Response;
    try {
      connectResponse = await fetchWithTimeout(
        `/api/connect?targetLanguage=${encodeURIComponent(targetLanguage)}&listeningMode=${encodeURIComponent(listeningMode)}&translationMode=${encodeURIComponent(translationMode)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: localSdp,
        },
        CONNECTION_TIMEOUT_MS
      );
    } catch {
      onStatusChange("error");
      onError(
        "OpenAI 연결이 시간 초과되었습니다. 1~2분 기다린 뒤 다시 시도해 주세요."
      );
      await cleanupSession({
        peerConnection,
        mediaStream,
        audioElement,
        dataChannel,
        stopMediaTracks: !reusedStream,
      });
      throw new Error("Connect request timed out");
    }

    const connectData = (await connectResponse.json()) as {
      answerSdp?: string;
      error?: string;
    };

    if (!connectResponse.ok || !connectData.answerSdp) {
      onStatusChange("error");
      onError(connectData.error ?? "OpenAI 번역 연결에 실패했습니다.");
      await cleanupSession({
        peerConnection,
        mediaStream,
        audioElement,
        dataChannel,
        stopMediaTracks: !reusedStream,
      });
      throw new Error(connectData.error ?? "Connect failed");
    }

    await peerConnection.setRemoteDescription({
      type: "answer",
      sdp: normalizeSdp(connectData.answerSdp),
    });

    onStatusChange("translating");

    return {
      stop: async (options) => {
        clearCommitTimers();
        if (!options?.discardBuffers) {
          commitEntry(buffers, detectedSourceLanguage, { force: true });
        } else {
          buffers.original = "";
          buffers.translated = "";
          buffers.inputDone = false;
          buffers.outputDone = false;
        }
        await cleanupSession({
          peerConnection,
          mediaStream,
          audioElement,
          dataChannel,
          stopMediaTracks: !options?.keepMediaStream,
        });
        if (!options?.skipStatusUpdate) {
          onStatusChange("stopped");
        }
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const alreadyHandled =
      message === "Connect request timed out" ||
      message.includes("rate_limit") ||
      message.includes("Rate limit") ||
      message.includes("OpenAI");

    if (!alreadyHandled) {
      onStatusChange("error");
      onError(
        message
          ? `연결 중 오류: ${message}`
          : "연결 중 알 수 없는 오류가 발생했습니다."
      );
      await cleanupSession({
        peerConnection,
        mediaStream,
        audioElement,
        dataChannel,
        stopMediaTracks: !reusedStream,
      });
    }

    throw error;
  }
}

function handleRealtimeEvent(
  event: RealtimeEvent,
  context: {
    buffers: TranscriptBuffers;
    listeningMode: ListeningMode;
    translationMode: TranslationMode;
    myLanguage: LanguageCode;
    getDetectedSourceLanguage: () => LanguageCode | null;
    outputLanguage: LanguageCode;
    onOriginalDelta: (delta: string) => void;
    onTranslatedDelta: (delta: string) => void;
    onOriginalSegment?: (text: string) => void;
    onTranslatedSegment?: (text: string) => void;
    onUtteranceStart?: () => void;
    onSkippedUtterance?: (originalText: string) => void;
    onModeMismatchUtterance?: (
      originalText: string,
      translatedText: string,
      textDirection: ListeningMode
    ) => void;
    onEntryCommitted: (entry: ConversationEntry) => void;
    onError: (message: string) => void;
    scheduleCommit: () => void;
    scheduleDoneCommit: () => void;
    updateDetectedFromText: (text: string, utteranceStart?: boolean) => void;
    commitEntry: (
      buffers: TranscriptBuffers,
      detected: LanguageCode | null,
      options?: { force?: boolean }
    ) => void;
    clearCommitTimers: () => void;
    checkLanguageBoundary: (
      buffers: TranscriptBuffers,
      utteranceStart: boolean
    ) => void;
    syncRemoteAudioMute: (referenceText: string) => void;
    refreshInputTranscription: (force?: boolean) => void;
    onOutputUtteranceStart?: () => void;
  }
): void {
  const {
    buffers,
    listeningMode,
    myLanguage,
    getDetectedSourceLanguage,
    onOriginalDelta,
    onTranslatedDelta,
    onOriginalSegment,
    onTranslatedSegment,
    onUtteranceStart,
    onError,
    scheduleCommit,
    scheduleDoneCommit,
    updateDetectedFromText,
    commitEntry,
    clearCommitTimers,
    checkLanguageBoundary,
    syncRemoteAudioMute,
    refreshInputTranscription,
    onOutputUtteranceStart,
  } = context;

  logRealtimeEvent(event, buffers);

  switch (event.type) {
    case "session.input_transcript.delta":
      if (event.delta) {
        if (buffers.inputDone) {
          // done 직후 추가 delta → 같은 발화로 이어 붙임 (thank → thank you)
          buffers.inputDone = false;
          clearCommitTimers();
        }
        const isUtteranceStart = buffers.original.length === 0;
        if (isUtteranceStart) {
          buffers.translated = "";
          buffers.peakTranslated = "";
          buffers.inputDone = false;
          buffers.outputDone = false;
          onUtteranceStart?.();
        }
        buffers.original += event.delta;
        syncPeakOriginal(buffers);
        onOriginalDelta(event.delta);
        syncRemoteAudioMute(buffers.original);
        checkLanguageBoundary(buffers, isUtteranceStart);
        updateDetectedFromText(buffers.original, isUtteranceStart);
        scheduleCommit();
      }
      break;
    case "session.output_transcript.delta":
      if (event.delta) {
        const isUtteranceStart = !buffers.original && buffers.translated.length === 0;
        if (isUtteranceStart) {
          onUtteranceStart?.();
          onOutputUtteranceStart?.();
          syncRemoteAudioMute("");
        }
        buffers.translated += event.delta;
        syncPeakTranslated(buffers);
        onTranslatedDelta(event.delta);
        scheduleCommit();
      }
      break;
    case "session.input_transcript.done":
      if (event.transcript) {
        const doneText = event.transcript.trim();
        const accumulated = buffers.original.trim();
        // .done transcript가 delta 누적보다 짧으면 잘린 텍스트로 덮어쓰지 않습니다.
        buffers.original =
          doneText.length >= accumulated.length ? doneText : accumulated;
        syncPeakOriginal(buffers);
        buffers.original = resolveOriginalText(buffers);
        syncPeakOriginal(buffers);
        onOriginalSegment?.(buffers.original);
        syncRemoteAudioMute(buffers.original);
        updateDetectedFromText(buffers.original);
      }
      buffers.inputDone = true;
      // 원문 세그먼트 완료 후 짧게 대기했다가 커밋 (연속 발화도 끊기지 않게)
      scheduleDoneCommit();
      break;
    case "session.output_transcript.done":
      if (event.transcript) {
        buffers.translated = event.transcript;
        syncPeakTranslated(buffers);
        buffers.translated = resolveTranslatedText(buffers);
        syncPeakTranslated(buffers);
        onTranslatedSegment?.(event.transcript);
      }
      buffers.outputDone = true;
      // 원문이 아직 없으면 잠시 더 기다린 뒤 번역만으로라도 커밋을 시도합니다.
      if (!buffers.inputDone && buffers.translated.trim()) {
        scheduleCommit();
      }
      break;
    case "error":
      onError(event.error?.message ?? "번역 중 오류가 발생했습니다.");
      break;
    default:
      break;
  }
}

/** 디버그용: 실시간 이벤트 흐름을 콘솔에 남깁니다. */
function logRealtimeEvent(event: RealtimeEvent, buffers: TranscriptBuffers): void {
  if (typeof window === "undefined") {
    return;
  }
  const debugOn =
    process.env.NODE_ENV === "development" ||
    (window as unknown as { __RT_DEBUG?: boolean }).__RT_DEBUG;
  if (!debugOn) {
    return;
  }
  const detail =
    "delta" in event && event.delta
      ? `delta="${event.delta}"`
      : "transcript" in event && event.transcript
        ? `transcript="${event.transcript}"`
        : "";
  // eslint-disable-next-line no-console
  console.log(
    `[rt] ${event.type} ${detail} | orig="${buffers.original}" trans="${buffers.translated}"`
  );
}

function clearTranscriptBuffers(buffers: TranscriptBuffers): void {
  buffers.original = "";
  buffers.translated = "";
  buffers.inputDone = false;
  buffers.outputDone = false;
  buffers.peakOriginal = "";
  buffers.peakTranslated = "";
}

/** 원문·번역이 모두 준비된 뒤 한 구간을 기록합니다. */
function commitSegmentIfReady(
  buffers: TranscriptBuffers,
  context: {
    listeningMode: ListeningMode;
    translationMode: TranslationMode;
    myLanguage: LanguageCode;
    detectedSourceLanguage: LanguageCode | null;
    outputLanguage: LanguageCode;
    partnerOutputLanguage: LanguageCode;
  },
  onEntryCommitted: (entry: ConversationEntry) => void,
  options?: { force?: boolean },
  afterCommit?: () => void
): void {
  const {
    listeningMode,
    translationMode,
    myLanguage,
    detectedSourceLanguage,
    partnerOutputLanguage,
  } = context;

  const originalTextRaw = resolveOriginalText(buffers);
  const translatedText = resolveTranslatedText(buffers);

  let originalText = originalTextRaw;
  if (
    translatedText &&
    /[\uAC00-\uD7AF]/.test(originalText) &&
    /[\uAC00-\uD7AF]/.test(translatedText) &&
    translatedText.length > originalText.length + 3
  ) {
    const compactOriginal = originalText.replace(/\s+/g, "");
    const compactTranslated = translatedText.replace(/\s+/g, "");
    if (compactTranslated.includes(compactOriginal)) {
      originalText = translatedText;
    }
  }

  if (!originalText && !translatedText) {
    clearTranscriptBuffers(buffers);
    return;
  }

  // 원문 없이 번역(내 언어)만 도착: 상대방 외국어 발화로 처리합니다.
  if (!originalText && translatedText) {
    const transInferred =
      inferInputLanguageFast(translatedText, myLanguage) ??
      inferInputLanguage(translatedText, myLanguage);
    const looksLikeMyLanguage =
      transInferred && isInputMyLanguage(transInferred, myLanguage);

    if (!looksLikeMyLanguage && !options?.force) {
      return;
    }

    // 내 언어 echo만 있고 원문 없음 → 사용자 발화 대기 (잘못된 상대방 커밋 방지)
    if (
      detectedSourceLanguage === myLanguage &&
      looksLikeMyLanguage &&
      !options?.force
    ) {
      return;
    }

    if (
      detectedSourceLanguage === myLanguage &&
      looksLikeMyLanguage &&
      options?.force
    ) {
      clearTranscriptBuffers(buffers);
      afterCommit?.();
      return;
    }

    const sourceLanguage =
      detectedSourceLanguage && detectedSourceLanguage !== myLanguage
        ? detectedSourceLanguage
        : partnerOutputLanguage;

    onEntryCommitted({
      id: createId(),
      speaker: "partner",
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      sourceLanguage,
      targetLanguage: myLanguage,
      sourceLang: sourceLanguage,
      targetLang: myLanguage,
      originalText: "",
      translatedText,
      direction: "listen",
    });

    clearTranscriptBuffers(buffers);
    afterCommit?.();
    return;
  }

  if (!options?.force) {
    if (!buffers.inputDone) {
      return;
    }
  }

  const inferred =
    inferInputLanguageFast(originalText, myLanguage) ??
    inferInputLanguage(originalText, myLanguage);
  const entryDirection =
    translationMode === "auto"
      ? resolveDirectionForText(originalText, myLanguage) ?? listeningMode
      : listeningMode;

  const sourceLanguage =
    entryDirection === "listen"
      ? inferred?.outputCode ?? detectedSourceLanguage ?? "en"
      : myLanguage;
  const entryTargetLanguage =
    entryDirection === "listen" ? myLanguage : partnerOutputLanguage;

  // 상대방 발화(listen): 세션 번역(내 언어)을 그대로 사용합니다. (원문==번역 echo는 제외)
  // 내 발화(speak): 세션 번역은 echo이므로 비워서 패널이 상대 언어로 다시 번역하게 합니다.
  const usableTranslation =
    entryDirection === "listen" && translatedText && translatedText !== originalText
      ? translatedText
      : "";

  onEntryCommitted({
    id: createId(),
    speaker: entryDirection === "speak" ? "user" : "partner",
    timestamp: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    sourceLanguage,
    targetLanguage: entryTargetLanguage,
    sourceLang: sourceLanguage,
    targetLang: entryTargetLanguage,
    originalText,
    translatedText: usableTranslation,
    direction: entryDirection,
  });

  clearTranscriptBuffers(buffers);
  afterCommit?.();
}

async function cleanupSession(resources: {
  peerConnection: RTCPeerConnection;
  mediaStream: MediaStream;
  audioElement: HTMLAudioElement;
  dataChannel?: RTCDataChannel;
  stopMediaTracks?: boolean;
}): Promise<void> {
  const {
    peerConnection,
    mediaStream,
    audioElement,
    dataChannel,
    stopMediaTracks = true,
  } = resources;

  if (dataChannel?.readyState === "open") {
    dataChannel.close();
  }

  peerConnection.getSenders().forEach((sender) => {
    if (stopMediaTracks) {
      sender.track?.stop();
    }
  });

  if (stopMediaTracks) {
    cleanupMediaStream(mediaStream);
  }

  peerConnection.close();

  audioElement.pause();
  audioElement.srcObject = null;
}

function cleanupMediaStream(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}
