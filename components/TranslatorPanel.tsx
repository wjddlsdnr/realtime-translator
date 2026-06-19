"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ConversationSidebar from "@/components/ConversationSidebar";
import ChatConversation from "@/components/ChatConversation";
import DetectedLanguageBadge from "@/components/DetectedLanguageBadge";
import MicLevelIndicator from "@/components/MicLevelIndicator";
import PartnerViewOverlay from "@/components/PartnerViewOverlay";
import PartnerViewStrip from "@/components/PartnerViewStrip";
import ProfilePanel from "@/components/ProfilePanel";
import SettingsSheet from "@/components/SettingsSheet";
import StatusBadge from "@/components/StatusBadge";
import SummaryPanel from "@/components/SummaryPanel";
import TravelStatusBar from "@/components/TravelStatusBar";
import {
  getBootstrapSessionDirection,
  resolveDirectionForText,
} from "@/lib/autoDirection";
import {
  downloadConversationAsJson,
  downloadConversationAsText,
} from "@/lib/download";
import {
  getActiveSpeechText,
  inferInputLanguage,
  inferInputLanguageFast,
  isInputMyLanguage,
  type InferredInputLanguage,
} from "@/lib/detectLanguage";
import {
  buildPartnerLanguageState,
  resolvePartnerOutputLanguage,
  resolveSessionOutputLanguage,
  shouldUpdatePartnerLanguage,
  type PartnerLanguageState,
} from "@/lib/partnerLanguage";
import { loadUserProfile } from "@/lib/profileStorage";
import { createSessionLock } from "@/lib/sessionLock";
import { speakTranslatedText, stopSpeaking } from "@/lib/speechOutput";
import {
  startRealtimeTranslation,
  type RealtimeSessionHandle,
} from "@/lib/realtime";
import type { SessionDirection, TranslationMode } from "@/lib/sessionConfig";
import {
  appendEntryToThread,
  clearThreadMessages,
  createThread,
  deleteThread,
  getThreadById,
  loadActiveThreadId,
  loadThreads,
  migrateLegacyConversationLog,
  renameThread,
  saveActiveThreadId,
  saveThreadSummary,
  updateThreadEntryOriginal,
  updateThreadEntryTranslation,
  upsertThread,
  type ConversationThread,
} from "@/lib/threadStorage";
import type {
  ConnectionStatus,
  ConversationEntry,
  LanguageCode,
  SummaryResult,
  UserProfile,
} from "@/lib/types";
import { getLanguageLabel } from "@/lib/types";
import { createId } from "@/lib/id";
import {
  findLatestPartnerFacingPayload,
  type PartnerViewPayload,
} from "@/lib/partnerView";

export default function TranslatorPanel() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [liveDetectedLabel, setLiveDetectedLabel] = useState<string | null>(
    null
  );
  const [partnerLanguage, setPartnerLanguage] =
    useState<PartnerLanguageState | null>(null);
  const [translationMode, setTranslationMode] = useState<TranslationMode>("auto");
  const [manualDirection, setManualDirection] = useState<SessionDirection>("listen");
  const [activeDirection, setActiveDirection] = useState<SessionDirection>("listen");
  const [hasConfirmedSpeaker, setHasConfirmedSpeaker] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [liveOriginal, setLiveOriginal] = useState("");
  const [liveTranslated, setLiveTranslated] = useState("");
  const [liveStartedAt, setLiveStartedAt] = useState<string | null>(null);
  const [liveUtteranceDirection, setLiveUtteranceDirection] =
    useState<SessionDirection | null>(null);
  const [entries, setEntries] = useState<ConversationEntry[]>([]);
  const entriesRef = useRef<ConversationEntry[]>([]);
  const summaryRef = useRef<SummaryResult | null>(null);
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [infoMessage, setInfoMessage] = useState("");
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [partnerViewPinned, setPartnerViewPinned] = useState(false);
  const [partnerViewOverlay, setPartnerViewOverlay] =
    useState<PartnerViewPayload | null>(null);

  const sessionRef = useRef<RealtimeSessionHandle | null>(null);
  const partnerLanguageRef = useRef<PartnerLanguageState | null>(null);
  const activeThreadIdRef = useRef<string | null>(null);
  const translationModeRef = useRef<TranslationMode>(translationMode);
  const activeDirectionRef = useRef<SessionDirection>("listen");
  const activeOutputLanguageRef = useRef<LanguageCode | null>(null);
  const isSessionActiveRef = useRef(false);
  const hasConfirmedSpeakerRef = useRef(false);
  const sessionEpochRef = useRef(0);
  const sessionLockRef = useRef(createSessionLock());
  const sharedMicStreamRef = useRef<MediaStream | null>(null);
  const translatingEntryIdsRef = useRef<Set<string>>(new Set());
  const connectSessionRef = useRef<
    (sessionDirection: SessionDirection, options?: { resetTranscript?: boolean }) => Promise<void>
  >(async () => {});
  const applySessionTargetRef = useRef<
    (direction: SessionDirection, inferred: InferredInputLanguage) => Promise<void>
  >(async () => {});
  const pendingDirectionSwitchRef = useRef<{
    direction: SessionDirection;
    inferred: InferredInputLanguage;
  } | null>(null);

  translationModeRef.current = translationMode;
  activeDirectionRef.current = activeDirection;
  hasConfirmedSpeakerRef.current = hasConfirmedSpeaker;
  activeThreadIdRef.current = activeThreadId;
  entriesRef.current = entries;
  summaryRef.current = summary;

  const myLanguage = profile?.myLanguage ?? "ko";
  const displayDirection =
    translationMode === "auto" ? activeDirection : manualDirection;
  const sessionOutputLanguage = profile
    ? resolveSessionOutputLanguage(displayDirection, profile.myLanguage, partnerLanguage)
    : myLanguage;

  const loadThreadIntoState = useCallback((thread: ConversationThread) => {
    setActiveThreadId(thread.id);
    activeThreadIdRef.current = thread.id;
    saveActiveThreadId(thread.id);
    entriesRef.current = thread.entries;
    setEntries(thread.entries);
    setPartnerLanguage(thread.partnerLanguage);
    partnerLanguageRef.current = thread.partnerLanguage;
    setLiveDetectedLabel(thread.partnerLanguage?.detectedLabel ?? null);
    summaryRef.current = thread.summary;
    setSummary(thread.summary);
    setLiveOriginal("");
    setLiveTranslated("");
    setLiveStartedAt(null);
    setLiveUtteranceDirection(null);
    hasConfirmedSpeakerRef.current = false;
    setHasConfirmedSpeaker(false);
  }, []);

  const persistCurrentThread = useCallback(() => {
    const threadId = activeThreadIdRef.current;
    if (!threadId) {
      return;
    }

    const existing = getThreadById(threadId);
    if (!existing) {
      return;
    }

    upsertThread({
      ...existing,
      entries: entriesRef.current,
      partnerLanguage: partnerLanguageRef.current,
      summary: summaryRef.current,
    });
    setThreads(loadThreads());
  }, []);

  const commitPartnerFromInference = useCallback(
    (inferred: InferredInputLanguage): boolean => {
      if (!profile) {
        return false;
      }

      const isMine = isInputMyLanguage(inferred, profile.myLanguage);
      if (
        !shouldUpdatePartnerLanguage(
          inferred.outputCode,
          inferred.displayName,
          profile.myLanguage,
          isMine
        )
      ) {
        return false;
      }

      const nextState = buildPartnerLanguageState(
        inferred.outputCode,
        inferred.displayName,
        inferred.francCode
      );

      const changed =
        partnerLanguageRef.current?.detectedLabel !== nextState.detectedLabel ||
        partnerLanguageRef.current?.outputLanguage !== nextState.outputLanguage;

      if (!changed) {
        return false;
      }

      partnerLanguageRef.current = nextState;
      setPartnerLanguage(nextState);
      setLiveDetectedLabel(inferred.displayName);
      return true;
    },
    [profile]
  );

  const syncLiveFromText = useCallback(
    (text: string) => {
      const active = getActiveSpeechText(text);
      const dir = resolveDirectionForText(active || text, myLanguage);
      if (dir) {
        setLiveUtteranceDirection(dir);
      }
      return text;
    },
    [myLanguage]
  );

  const handleInputLanguage = useCallback(
    (inferred: InferredInputLanguage, sourceText: string) => {
      if (!profile || translationModeRef.current !== "auto") {
        return;
      }

      if (sourceText.trim().length < 2) {
        return;
      }

      if (!isInputMyLanguage(inferred, profile.myLanguage)) {
        commitPartnerFromInference(inferred);
        setLiveDetectedLabel(inferred.displayName);
      }
    },
    [profile, commitPartnerFromInference]
  );

  const updateMessageTranslation = useCallback(
    (entryId: string, translatedText: string) => {
      const threadId = activeThreadIdRef.current;
      if (!threadId || !translatedText.trim()) {
        return;
      }

      const updatedThread = updateThreadEntryTranslation(
        threadId,
        entryId,
        translatedText.trim()
      );
      if (!updatedThread) {
        return;
      }

      entriesRef.current = updatedThread.entries;
      setEntries(updatedThread.entries);
      setThreads(loadThreads());
    },
    []
  );

  const updateMessageOriginal = useCallback((entryId: string, originalText: string) => {
    const threadId = activeThreadIdRef.current;
    if (!threadId || !originalText.trim()) {
      return;
    }

    const updatedThread = updateThreadEntryOriginal(threadId, entryId, originalText.trim());
    if (!updatedThread) {
      return;
    }

    entriesRef.current = updatedThread.entries;
    setEntries(updatedThread.entries);
    setThreads(loadThreads());
  }, []);

  const fillOriginalFromTranslation = useCallback(
    async (
      entryId: string,
      translatedText: string,
      sourceLang: LanguageCode,
      targetLang: LanguageCode
    ) => {
      if (translatingEntryIdsRef.current.has(entryId)) {
        return;
      }

      translatingEntryIdsRef.current.add(entryId);
      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: translatedText,
            sourceLang,
            targetLang,
          }),
        });
        const data = (await response.json()) as {
          translatedText?: string;
          error?: string;
        };
        if (!response.ok || !data.translatedText?.trim()) {
          return;
        }
        updateMessageOriginal(entryId, data.translatedText.trim());
      } catch {
        // 원문 복원 실패는 치명적이지 않으므로 무시합니다.
      } finally {
        translatingEntryIdsRef.current.delete(entryId);
      }
    },
    [updateMessageOriginal]
  );

  const translateMessage = useCallback(
    async (
      entryId: string,
      text: string,
      sourceLang: LanguageCode,
      targetLang: LanguageCode,
      options?: { speakOnComplete?: boolean }
    ) => {
      const trimmed = text.trim();
      if (!trimmed || sourceLang === targetLang) {
        return;
      }

      if (translatingEntryIdsRef.current.has(entryId)) {
        return;
      }

      translatingEntryIdsRef.current.add(entryId);
      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: trimmed,
            sourceLang,
            targetLang,
          }),
        });

        const data = (await response.json()) as {
          translatedText?: string;
          error?: string;
        };

        if (!response.ok || !data.translatedText) {
          setErrorMessage(data.error ?? "메시지 번역에 실패했습니다.");
          return;
        }

        updateMessageTranslation(entryId, data.translatedText);
        if (options?.speakOnComplete) {
          speakTranslatedText(data.translatedText, targetLang);
        }
      } catch {
        setErrorMessage("메시지 번역 요청 중 네트워크 오류가 발생했습니다.");
      } finally {
        translatingEntryIdsRef.current.delete(entryId);
      }
    },
    [updateMessageTranslation]
  );

  const addMessage = useCallback(
    (input: {
      id?: string;
      speaker?: "user" | "partner";
      direction?: SessionDirection;
      originalText: string;
      translatedText?: string;
      sourceLang?: LanguageCode;
      targetLang?: LanguageCode;
      sourceDisplayName?: string;
      createdAt?: string;
      translateIfMissing?: boolean;
    }): ConversationEntry | null => {
      if (!profile) {
        return null;
      }

      const originalText = input.originalText.trim();
      const translatedText = input.translatedText?.trim() ?? "";

      if (!originalText && !translatedText) {
        return null;
      }

      // 원문 이벤트 누락 + 번역만 있는 상대방 발화
      if (!originalText && translatedText) {
        const direction: SessionDirection = input.direction ?? "listen";
        if (direction !== "listen") {
          return null;
        }

        const sourceLang: LanguageCode =
          input.sourceLang ??
          partnerLanguageRef.current?.outputLanguage ??
          "en";
        const targetLang: LanguageCode = profile.myLanguage;
        const createdAt = input.createdAt ?? new Date().toISOString();
        const entry: ConversationEntry = {
          id: input.id ?? createId(),
          speaker: "partner",
          timestamp: createdAt,
          createdAt,
          sourceLanguage: sourceLang,
          targetLanguage: targetLang,
          sourceLang,
          targetLang,
          originalText: "",
          translatedText,
          direction: "listen",
          sourceDisplayName:
            input.sourceDisplayName ??
            partnerLanguageRef.current?.detectedLabel,
        };

        const threadId = activeThreadIdRef.current;
        if (!threadId) {
          return null;
        }

        const updatedThread = appendEntryToThread(threadId, entry);
        if (!updatedThread) {
          return null;
        }

        entriesRef.current = updatedThread.entries;
        setEntries(updatedThread.entries);
        if (partnerLanguageRef.current) {
          upsertThread({
            ...updatedThread,
            partnerLanguage: partnerLanguageRef.current,
          });
        }
        setThreads(loadThreads());

        // 한국어 번역만 있을 때 영어 원문을 API로 복원합니다.
        void fillOriginalFromTranslation(
          entry.id,
          translatedText,
          profile.myLanguage,
          sourceLang
        );

        return entry;
      }

      const inferred =
        inferInputLanguageFast(originalText, profile.myLanguage) ??
        inferInputLanguage(originalText, profile.myLanguage);
      const direction: SessionDirection =
        input.direction ??
        (input.speaker === "user"
          ? "speak"
          : input.speaker === "partner"
            ? "listen"
            : resolveDirectionForText(originalText, profile.myLanguage) ?? "listen");
      const speaker = input.speaker ?? (direction === "speak" ? "user" : "partner");

      if (speaker === "partner" && inferred && !isInputMyLanguage(inferred, profile.myLanguage)) {
        commitPartnerFromInference(inferred);
      }

      // 화자 기준으로 source/target을 매번 계산합니다. (live 상대 언어 사용)
      const sourceLang: LanguageCode =
        speaker === "user"
          ? profile.myLanguage
          : inferred?.outputCode ??
            input.sourceLang ??
            partnerLanguageRef.current?.outputLanguage ??
            "en";
      const targetLang: LanguageCode =
        speaker === "user"
          ? resolvePartnerOutputLanguage(partnerLanguageRef.current)
          : profile.myLanguage;
      const createdAt = input.createdAt ?? new Date().toISOString();
      const entry: ConversationEntry = {
        id: input.id ?? createId(),
        speaker,
        timestamp: createdAt,
        createdAt,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        sourceLang,
        targetLang,
        originalText,
        translatedText,
        direction,
        sourceDisplayName: input.sourceDisplayName ?? inferred?.displayName,
      };

      const threadId = activeThreadIdRef.current;
      if (!threadId) {
        return null;
      }

      const updatedThread = appendEntryToThread(threadId, entry);
      if (!updatedThread) {
        return null;
      }

      entriesRef.current = updatedThread.entries;
      setEntries(updatedThread.entries);
      if (partnerLanguageRef.current) {
        upsertThread({
          ...updatedThread,
          partnerLanguage: partnerLanguageRef.current,
        });
      }
      setThreads(loadThreads());

      // 번역이 비어 있고 원문이 있을 때만 텍스트 번역 API로 채웁니다.
      // (상대방 발화는 세션 번역을 이미 갖고 있으므로 재번역하지 않습니다.)
      if (
        input.translateIfMissing !== false &&
        !translatedText &&
        originalText &&
        sourceLang !== targetLang
      ) {
        void translateMessage(entry.id, originalText, sourceLang, targetLang, {
          speakOnComplete: speaker === "user",
        });
      }

      return entry;
    },
    [profile, commitPartnerFromInference, translateMessage, fillOriginalFromTranslation]
  );

  const handleModeMismatchUtterance = useCallback(
    (
      originalText: string,
      translatedText: string,
      textDirection: SessionDirection
    ) => {
      if (!profile) {
        return;
      }

      const active = originalText;
      const inferred =
        inferInputLanguageFast(active, profile.myLanguage) ??
        inferInputLanguage(active, profile.myLanguage);
      if (!inferred || !active.trim()) {
        if (inferred) {
          pendingDirectionSwitchRef.current = null;
          void applySessionTargetRef.current(textDirection, inferred);
        }
        return;
      }

      pendingDirectionSwitchRef.current = null;
      addMessage({
        speaker: textDirection === "speak" ? "user" : "partner",
        direction: textDirection,
        originalText: active,
        translatedText,
        sourceLang:
          textDirection === "speak"
            ? profile.myLanguage
            : inferred.outputCode ?? "en",
        targetLang:
          textDirection === "speak"
            ? resolvePartnerOutputLanguage(partnerLanguageRef.current)
            : profile.myLanguage,
        sourceDisplayName: inferred.displayName,
      });

      setLiveOriginal("");
      setLiveTranslated("");
      setLiveStartedAt(null);
      setLiveUtteranceDirection(null);

      void applySessionTargetRef.current(textDirection, inferred);
    },
    [profile, addMessage]
  );

  const requestDirectionSwitchRef = useRef<
    (
      inferred: InferredInputLanguage,
      sourceText: string,
      options?: { force?: boolean }
    ) => void
  >(() => {});

  const connectSession = useCallback(
    async (
      sessionDirection: SessionDirection,
      options?: { resetTranscript?: boolean }
    ) => {
      if (!profile) {
        return;
      }

      const callbackEpoch = sessionEpochRef.current;

      if (options?.resetTranscript) {
        setLiveOriginal("");
        setLiveTranslated("");
        setLiveDetectedLabel(null);
      }

      const outputLanguage = resolveSessionOutputLanguage(
        sessionDirection,
        profile.myLanguage,
        partnerLanguageRef.current
      );
      activeOutputLanguageRef.current = outputLanguage;
      activeDirectionRef.current = sessionDirection;
      setActiveDirection(sessionDirection);

      const session = await startRealtimeTranslation({
        targetLanguage: outputLanguage,
        myLanguage: profile.myLanguage,
        partnerOutputLanguage: resolvePartnerOutputLanguage(
          partnerLanguageRef.current
        ),
        listeningMode: sessionDirection,
        translationMode: translationModeRef.current,
        existingMediaStream: sharedMicStreamRef.current ?? undefined,
        onStatusChange: (nextStatus) => {
          if (callbackEpoch === sessionEpochRef.current) {
            setStatus(nextStatus);
          }
        },
        onError: setErrorMessage,
        onInputLanguageDetected: handleInputLanguage,
        onUtteranceLanguageDetected: (inferred, sourceText) => {
          if (callbackEpoch !== sessionEpochRef.current) {
            return;
          }
          requestDirectionSwitchRef.current(inferred, sourceText);
        },
        onUtteranceStart: () => {
          if (callbackEpoch !== sessionEpochRef.current) {
            return;
          }
          setLiveOriginal("");
          setLiveTranslated("");
          setLiveStartedAt(new Date().toISOString());
          setLiveUtteranceDirection(null);
        },
        onSkippedUtterance: (originalText) => {
          if (callbackEpoch !== sessionEpochRef.current) {
            return;
          }
          setLiveOriginal("");
          setLiveTranslated("");
          const inferred =
            inferInputLanguageFast(originalText, profile.myLanguage) ??
            inferInputLanguage(originalText, profile.myLanguage);
          const direction =
            resolveDirectionForText(originalText, profile.myLanguage) ??
            activeDirectionRef.current;
          addMessage({
            speaker: direction === "speak" ? "user" : "partner",
            direction,
            originalText,
          });
          if (inferred) {
            requestDirectionSwitchRef.current(inferred, originalText, {
              force: true,
            });
          }
        },
        onModeMismatchUtterance: (originalText, translatedText, textDirection) => {
          if (callbackEpoch !== sessionEpochRef.current) {
            return;
          }
          handleModeMismatchUtterance(
            originalText,
            translatedText,
            textDirection
          );
        },
        onMediaStreamReady: (stream) => {
          sharedMicStreamRef.current = stream;
          setMicStream(stream);
        },
        onOriginalDelta: (delta) => {
          if (callbackEpoch !== sessionEpochRef.current) {
            return;
          }
          setLiveOriginal((prev) => syncLiveFromText(prev + delta));
        },
        onTranslatedDelta: (delta) => {
          if (callbackEpoch !== sessionEpochRef.current) {
            return;
          }
          setLiveTranslated((prev) => prev + delta);
        },
        onOriginalSegment: (text) => {
          if (callbackEpoch !== sessionEpochRef.current) {
            return;
          }
          setLiveOriginal(syncLiveFromText(text));
        },
        onTranslatedSegment: (text) => {
          if (callbackEpoch !== sessionEpochRef.current) {
            return;
          }
          setLiveTranslated(text);
        },
        onEntryCommitted: (entry) => {
          if (callbackEpoch !== sessionEpochRef.current) {
            return;
          }

          // realtime이 화자/방향/번역을 계산해 넘기면, addMessage가 저장하고
          // 번역이 비어 있는 경우(내 발화)에만 텍스트 번역 API로 채웁니다.
          addMessage({
            id: entry.id,
            speaker: entry.speaker,
            direction: entry.direction,
            originalText: entry.originalText,
            translatedText: entry.translatedText,
            sourceLang: entry.sourceLanguage,
            targetLang: entry.targetLanguage,
            createdAt: entry.timestamp,
            translateIfMissing: true,
          });

          setLiveOriginal("");
          setLiveTranslated("");
          setLiveStartedAt(null);
          setLiveUtteranceDirection(null);
        },
      });

      if (callbackEpoch !== sessionEpochRef.current) {
        await session.stop({
          keepMediaStream: true,
          skipStatusUpdate: true,
          discardBuffers: true,
        });
        return;
      }

      sessionRef.current = session;
      isSessionActiveRef.current = true;
    },
    [profile, handleInputLanguage, syncLiveFromText, handleModeMismatchUtterance, addMessage]
  );

  connectSessionRef.current = connectSession;

  const requestDirectionSwitch = useCallback(
    (inferred: InferredInputLanguage, sourceText: string) => {
      if (!profile || translationModeRef.current !== "auto") {
        return;
      }

      const resolved =
        inferInputLanguageFast(sourceText, profile.myLanguage) ?? inferred;

      if (!hasConfirmedSpeakerRef.current) {
        hasConfirmedSpeakerRef.current = true;
        setHasConfirmedSpeaker(true);
      }

      // 단일 세션 구조: WebRTC 세션은 더 이상 방향을 바꾸지 않습니다.
      // 상대 언어만 갱신해두면, 내 말이 상대 언어로 번역될 때 사용됩니다.
      if (!isInputMyLanguage(resolved, profile.myLanguage)) {
        commitPartnerFromInference(resolved);
      }
    },
    [profile, commitPartnerFromInference]
  );

  requestDirectionSwitchRef.current = requestDirectionSwitch;

  const applySessionTarget = useCallback(
    async (targetDirection: SessionDirection, inferred: InferredInputLanguage) => {
      if (!profile || !isSessionActiveRef.current) {
        return;
      }

      await sessionLockRef.current.run(async () => {
        if (!isSessionActiveRef.current) {
          return;
        }

        if (!isInputMyLanguage(inferred, profile.myLanguage)) {
          commitPartnerFromInference(inferred);
        }

        const nextOutput = resolveSessionOutputLanguage(
          targetDirection,
          profile.myLanguage,
          partnerLanguageRef.current
        );

        if (
          targetDirection === activeDirectionRef.current &&
          nextOutput === activeOutputLanguageRef.current
        ) {
          pendingDirectionSwitchRef.current = null;
          return;
        }

        pendingDirectionSwitchRef.current = null;
        sessionEpochRef.current += 1;

        setInfoMessage(
          targetDirection === "listen"
            ? `상대방(${inferred.displayName}) → ${getLanguageLabel(myLanguage)}`
            : `나 → ${getLanguageLabel(nextOutput)}`
        );

        if (sessionRef.current) {
          await sessionRef.current.stop({
            keepMediaStream: true,
            skipStatusUpdate: true,
            discardBuffers: true,
          });
          sessionRef.current = null;
        }

        setLiveOriginal("");
        setLiveTranslated("");
        setLiveStartedAt(null);
        setLiveUtteranceDirection(null);

        try {
          await connectSessionRef.current(targetDirection);
        } catch {
          isSessionActiveRef.current = false;
          setStatus("error");
          setErrorMessage(
            "통역 방향 전환에 실패했습니다. 정지 후 다시 시작해 주세요."
          );
          return;
        }

        window.setTimeout(() => setInfoMessage(""), 2_000);
      });
    },
    [profile, commitPartnerFromInference, myLanguage]
  );

  applySessionTargetRef.current = applySessionTarget;

  const isActive =
    status === "requesting_mic" ||
    status === "creating_session" ||
    status === "connecting" ||
    status === "translating";

  const partnerOutputLanguage = resolvePartnerOutputLanguage(partnerLanguage);

  const liveBubbleDirection = useMemo(() => {
    if (!isActive) {
      return null;
    }
    if (liveUtteranceDirection) {
      return liveUtteranceDirection;
    }
    if (liveOriginal.trim()) {
      return (
        resolveDirectionForText(liveOriginal, myLanguage) ?? displayDirection
      );
    }
    if (liveTranslated.trim()) {
      const inferred =
        inferInputLanguageFast(liveTranslated, myLanguage) ??
        inferInputLanguage(liveTranslated, myLanguage);
      if (inferred && isInputMyLanguage(inferred, myLanguage)) {
        return "listen";
      }
    }
    return displayDirection;
  }, [
    isActive,
    liveUtteranceDirection,
    liveOriginal,
    liveTranslated,
    myLanguage,
    displayDirection,
  ]);

  const latestPartnerPayload = useMemo(
    () =>
      findLatestPartnerFacingPayload(
        entries,
        liveOriginal,
        liveTranslated,
        liveBubbleDirection,
        isActive,
        myLanguage,
        partnerOutputLanguage
      ),
    [
      entries,
      liveOriginal,
      liveTranslated,
      liveBubbleDirection,
      isActive,
      myLanguage,
      partnerOutputLanguage,
    ]
  );

  const startSession = useCallback(
    async (
      sessionDirection: SessionDirection,
      options?: { resetTranscript?: boolean }
    ) => {
      if (!profile) {
        return;
      }

      await sessionLockRef.current.run(async () => {
        sessionEpochRef.current += 1;

        if (sessionRef.current) {
          await sessionRef.current.stop({
            keepMediaStream: options?.resetTranscript ? false : true,
            skipStatusUpdate: options?.resetTranscript ? false : true,
            discardBuffers: true,
          });
          sessionRef.current = null;
        }

        await connectSessionRef.current(sessionDirection, options);
      });
    },
    [profile]
  );

  useEffect(() => {
    migrateLegacyConversationLog();
    setProfile(loadUserProfile());

    let loadedThreads = loadThreads();
    let activeId = loadActiveThreadId();

    if (!activeId || !getThreadById(activeId)) {
      const thread = loadedThreads[0] ?? createThread();
      activeId = thread.id;
      loadedThreads = loadThreads();
    }

    setThreads(loadedThreads);
    const activeThread = getThreadById(activeId);
    if (activeThread) {
      loadThreadIntoState(activeThread);
    }
  }, [loadThreadIntoState]);

  const handleNewThread = useCallback(() => {
    if (isActive) {
      setErrorMessage("통역 중에는 새 대화를 열 수 없습니다. 먼저 정지해 주세요.");
      return;
    }

    persistCurrentThread();
    const thread = createThread();
    setThreads(loadThreads());
    loadThreadIntoState(thread);
    setInfoMessage("새 대화창이 열렸습니다. 다른 상대와의 통역으로 시작합니다.");
    window.setTimeout(() => setInfoMessage(""), 2_000);
    setSidebarOpen(false);
  }, [isActive, persistCurrentThread, loadThreadIntoState]);

  const handleSelectThread = useCallback(
    (threadId: string) => {
      if (isActive) {
        setErrorMessage("통역 중에는 다른 대화창을 열 수 없습니다.");
        return;
      }

      persistCurrentThread();
      const thread = getThreadById(threadId);
      if (!thread) {
        setErrorMessage("저장된 대화창을 찾을 수 없습니다.");
        return;
      }

      loadThreadIntoState(thread);
      setThreads(loadThreads());
      setInfoMessage(`"${thread.title}" 대화창을 불러왔습니다.`);
      window.setTimeout(() => setInfoMessage(""), 2_000);
      setSidebarOpen(false);
    },
    [isActive, persistCurrentThread, loadThreadIntoState]
  );

  const handleSaveCurrentThread = useCallback(() => {
    persistCurrentThread();
    const threadId = activeThreadIdRef.current;
    if (threadId) {
      const saved = getThreadById(threadId);
      if (saved) {
        loadThreadIntoState(saved);
      }
    }
    setThreads(loadThreads());
    setInfoMessage("이 대화창이 저장되었습니다.");
    window.setTimeout(() => setInfoMessage(""), 2_000);
  }, [persistCurrentThread, loadThreadIntoState]);

  const handleRenameThread = useCallback((threadId: string, title: string) => {
    renameThread(threadId, title);
    setThreads(loadThreads());
  }, []);

  const handleDeleteThread = useCallback(
    (threadId: string) => {
      if (isActive && threadId === activeThreadIdRef.current) {
        setErrorMessage("통역 중인 대화창은 삭제할 수 없습니다.");
        return;
      }

      const nextThreads = deleteThread(threadId);
      setThreads(nextThreads);

      const nextActiveId = loadActiveThreadId();
      if (nextActiveId) {
        const thread = getThreadById(nextActiveId);
        if (thread) {
          loadThreadIntoState(thread);
        }
      } else {
        const created = createThread();
        setThreads(loadThreads());
        loadThreadIntoState(created);
      }
    },
    [isActive, loadThreadIntoState]
  );

  const handleStart = useCallback(async () => {
    if (!profile) {
      setErrorMessage("먼저 프로필에서 내 언어를 저장해 주세요.");
      return;
    }

    setErrorMessage("");
    setInfoMessage("");
    sharedMicStreamRef.current = null;
    setMicStream(null);
    isSessionActiveRef.current = true;
    hasConfirmedSpeakerRef.current = false;
    setHasConfirmedSpeaker(false);

    const initialDirection =
      translationMode === "auto"
        ? getBootstrapSessionDirection()
        : manualDirection;

    try {
      if (translationMode === "auto") {
        setInfoMessage("말하는 언어에 따라 자동으로 방향이 바뀝니다.");
      }

      await startSession(initialDirection, { resetTranscript: true });
    } catch {
      sessionRef.current = null;
      isSessionActiveRef.current = false;
    }
  }, [profile, translationMode, manualDirection, startSession]);

  const handleStop = useCallback(async () => {
    await sessionLockRef.current.run(async () => {
      // 먼저 세션을 정지하면서 진행 중이던 마지막 발화를 커밋(저장)합니다.
      // epoch는 정지 커밋이 끝난 뒤 올려, 마지막 말풍선이 사라지지 않게 합니다.
      if (sessionRef.current) {
        await sessionRef.current.stop({ keepMediaStream: false });
        sessionRef.current = null;
      } else {
        setStatus("stopped");
      }

      sessionEpochRef.current += 1;

      stopSpeaking();
      isSessionActiveRef.current = false;
      hasConfirmedSpeakerRef.current = false;
      setHasConfirmedSpeaker(false);
      activeOutputLanguageRef.current = null;
      sharedMicStreamRef.current = null;
      setMicStream(null);
      setInfoMessage("");
      setLiveOriginal("");
      setLiveTranslated("");
      persistCurrentThread();
    });
  }, [persistCurrentThread]);

  const handleClearLog = useCallback(() => {
    if (!activeThreadIdRef.current) {
      return;
    }

    if (!window.confirm("현재 대화창의 메시지만 모두 삭제할까요?")) {
      return;
    }

    const cleared = clearThreadMessages(activeThreadIdRef.current);
    if (cleared) {
      loadThreadIntoState(cleared);
      setThreads(loadThreads());
    }
  }, [loadThreadIntoState]);

  const handleExportText = useCallback(() => {
    if (!entries.length) {
      setErrorMessage("보낼 대화 기록이 없습니다.");
      return;
    }
    downloadConversationAsText(entries);
  }, [entries]);

  const handleExportJson = useCallback(() => {
    if (!entries.length) {
      setErrorMessage("보낼 대화 기록이 없습니다.");
      return;
    }
    downloadConversationAsJson(entries);
  }, [entries]);

  const handleGenerateSummary = useCallback(async () => {
    if (!entries.length) {
      setErrorMessage("요약할 대화 기록이 없습니다.");
      return;
    }

    setSummaryLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries,
          sourceLanguage:
            partnerLanguage?.outputLanguage ?? entries.at(-1)?.sourceLanguage ?? "en",
          targetLanguage: myLanguage,
        }),
      });

      const data = (await response.json()) as {
        summary?: SummaryResult;
        error?: string;
      };

      if (!response.ok || !data.summary) {
        setErrorMessage(data.error ?? "요약 생성에 실패했습니다.");
        return;
      }

      setSummary(data.summary);
      summaryRef.current = data.summary;
      if (activeThreadIdRef.current) {
        const updated = saveThreadSummary(activeThreadIdRef.current, data.summary);
        if (updated) {
          setThreads(loadThreads());
        }
      }
    } catch {
      setErrorMessage("요약 요청 중 네트워크 오류가 발생했습니다.");
    } finally {
      setSummaryLoading(false);
    }
  }, [entries, myLanguage, partnerLanguage]);

  return (
    <div className="app-layout">
      <ConversationSidebar
        threads={threads}
        activeThreadId={activeThreadId}
        isSessionActive={isActive}
        onSelectThread={handleSelectThread}
        onNewThread={handleNewThread}
        onSaveCurrent={handleSaveCurrentThread}
        onRenameThread={handleRenameThread}
        onDeleteThread={handleDeleteThread}
        mobileOpen={sidebarOpen}
        onToggleMobile={() => setSidebarOpen((open) => !open)}
        hideMobileToggle
      />

      <div className="translator-main">
        <div className="translator-panel">
      <header className="travel-header">
        <button
          type="button"
          className="travel-header-btn btn btn-outline hide-on-desktop"
          onClick={() => setSidebarOpen((open) => !open)}
          aria-expanded={sidebarOpen}
        >
          대화
        </button>
        <div className="travel-header-center">
          <h1>실시간 통역</h1>
          <p className="travel-header-tagline">자동 양방향 · 카톡형 대화</p>
        </div>
        <button
          type="button"
          className="travel-header-btn btn btn-outline"
          onClick={() => setSettingsOpen(true)}
          aria-label="설정 및 도구"
        >
          더보기
        </button>
      </header>

      {!profile ? (
        <ProfilePanel
          profile={profile}
          onProfileSaved={setProfile}
          disabled={isActive}
        />
      ) : null}

      <ChatConversation
        key={activeThreadId ?? "default"}
        entries={entries}
        liveOriginal={liveOriginal}
        liveTranslated={liveTranslated}
        liveDirection={liveBubbleDirection}
        liveStartedAt={liveStartedAt}
        isActive={isActive}
        partnerViewPinned={partnerViewPinned}
        onTogglePartnerView={() => setPartnerViewPinned((pinned) => !pinned)}
        onBubblePress={setPartnerViewOverlay}
      />

      <PartnerViewStrip
        payload={latestPartnerPayload}
        active={partnerViewPinned}
        onClose={() => setPartnerViewPinned(false)}
        onExpand={() => {
          if (latestPartnerPayload) {
            setPartnerViewOverlay(latestPartnerPayload);
          }
        }}
      />

      {partnerViewOverlay ? (
        <PartnerViewOverlay
          payload={partnerViewOverlay}
          onClose={() => setPartnerViewOverlay(null)}
        />
      ) : null}

      {profile ? (
        <TravelStatusBar
          status={status}
          myLanguage={profile.myLanguage}
          partnerLanguage={partnerLanguage}
          liveDetectedLabel={liveDetectedLabel}
          isActive={isActive}
        />
      ) : (
        <p className="travel-setup-hint">
          내 언어를 저장한 뒤 시작 버튼을 누르세요.
        </p>
      )}

      {infoMessage ? (
        <div className="info-banner info-banner-inline" role="status">
          {infoMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="error-banner error-banner-inline" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <div className="session-action-bar" role="toolbar" aria-label="통역 제어">
        <button
          type="button"
          className="btn btn-primary btn-session-start"
          onClick={handleStart}
          disabled={isActive || !profile}
        >
          시작
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-session-stop"
          onClick={handleStop}
          disabled={!isActive}
        >
          정지
        </button>
      </div>
      <div className="session-action-bar-spacer" aria-hidden />

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <ProfilePanel
          profile={profile}
          onProfileSaved={setProfile}
          disabled={isActive}
        />

        <div className="settings-section">
          <h3 className="settings-section-title">통역 설정</h3>
          {profile ? (
            <DetectedLanguageBadge
              myLanguage={profile.myLanguage}
              partnerLanguage={partnerLanguage}
              liveDetectedLabel={liveDetectedLabel}
              translationMode={translationMode}
              activeDirection={displayDirection}
              hasConfirmedSpeaker={hasConfirmedSpeaker}
              isListening={status === "translating"}
            />
          ) : null}

          <label className="language-selector">
            <span className="language-selector-label">통역 방식</span>
            <select
              value={translationMode}
              onChange={(event) =>
                setTranslationMode(event.target.value as TranslationMode)
              }
              disabled={isActive || !profile}
              className="language-select"
            >
              <option value="auto">자동 (언어로 화자 감지) — 권장</option>
              <option value="manual">수동</option>
            </select>
          </label>

          {translationMode === "manual" ? (
            <label className="language-selector">
              <span className="language-selector-label">수동 모드</span>
              <select
                value={manualDirection}
                onChange={(event) =>
                  setManualDirection(event.target.value as SessionDirection)
                }
                disabled={isActive || !profile}
                className="language-select"
              >
                <option value="listen">상대방 듣기</option>
                <option value="speak">내가 말하기</option>
              </select>
            </label>
          ) : null}

          {profile ? (
            <p className="session-output-notice">
              {translationMode === "auto"
                ? `자동 · 현재 출력: ${getLanguageLabel(sessionOutputLanguage)} (${
                    displayDirection === "listen" ? "상대→나" : "나→상대"
                  })`
                : `수동 · ${getLanguageLabel(sessionOutputLanguage)}`}
            </p>
          ) : null}

          <StatusBadge status={status} />
          <MicLevelIndicator stream={micStream} active={status === "translating"} />
        </div>

        <div className="settings-section">
          <h3 className="settings-section-title">대화 도구</h3>
          <div className="log-actions log-actions-compact">
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleGenerateSummary}
              disabled={summaryLoading || isActive}
            >
              AI 요약 생성
            </button>
            <button type="button" className="btn btn-outline" onClick={handleExportText}>
              텍스트로 보내기
            </button>
            <button type="button" className="btn btn-outline" onClick={handleExportJson}>
              JSON으로 보내기
            </button>
            <button type="button" className="btn btn-danger" onClick={handleClearLog}>
              현재 대화 비우기
            </button>
          </div>
          <SummaryPanel summary={summary} loading={summaryLoading} />
        </div>

        <p className="settings-consent-notice">
          상대방의 동의 후 사용하세요. 음성 원본은 저장하지 않고 텍스트만 기록합니다.
        </p>
      </SettingsSheet>
        </div>
      </div>
    </div>
  );
}
