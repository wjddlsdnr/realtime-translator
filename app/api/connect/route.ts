import { OUTPUT_LANGUAGE_CODES } from "@/lib/languages";
import { isSupportedOutputLanguage } from "@/lib/languages";
import type { LanguageCode } from "@/lib/languages";
import { NextResponse } from "next/server";
import { buildSessionAudioConfig, type ListeningMode, type TranslationMode } from "@/lib/sessionConfig";
import { normalizeSdp, isValidOfferSdp } from "@/lib/sdp";
import { toUserFriendlyOpenAiError } from "@/lib/openaiErrors";

const TRANSLATION_CLIENT_SECRET_URL =
  "https://api.openai.com/v1/realtime/translations/client_secrets";

const TRANSLATION_CALLS_URL =
  "https://api.openai.com/v1/realtime/translations/calls";

const OPENAI_TIMEOUT_MS = 60_000;

type ConnectRequestBody = {
  targetLanguage?: LanguageCode;
  listeningMode?: ListeningMode;
  translationMode?: TranslationMode;
  sdp?: string;
};

/** OpenAI client secret 발급 + WebRTC SDP 교환을 서버에서 처리합니다. */
export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "서버에 OPENAI_API_KEY가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  const url = new URL(request.url);
  let targetLanguage: LanguageCode = "ko";
  let listeningMode: ListeningMode = "listen";
  let translationMode: TranslationMode = "manual";
  let sdp = "";

  if (contentType.includes("application/sdp")) {
    targetLanguage = (url.searchParams.get("targetLanguage") ??
      "ko") as LanguageCode;
    listeningMode =
      url.searchParams.get("listeningMode") === "speak" ? "speak" : "listen";
    translationMode =
      url.searchParams.get("translationMode") === "auto" ? "auto" : "manual";
    sdp = normalizeSdp(await request.text());
  } else {
    let body: ConnectRequestBody;
    try {
      body = (await request.json()) as ConnectRequestBody;
    } catch {
      return NextResponse.json(
        { error: "요청 본문을 읽을 수 없습니다." },
        { status: 400 }
      );
    }

    targetLanguage = body.targetLanguage ?? "ko";
    listeningMode = body.listeningMode === "speak" ? "speak" : "listen";
    translationMode = body.translationMode === "auto" ? "auto" : "manual";
    sdp = normalizeSdp(body.sdp ?? "");
  }

  if (!isValidOfferSdp(sdp)) {
    return NextResponse.json(
      { error: "유효한 WebRTC SDP offer가 전달되지 않았습니다." },
      { status: 400 }
    );
  }

  if (!isSupportedOutputLanguage(targetLanguage)) {
    return NextResponse.json(
      {
        error: `지원하지 않는 출력 언어입니다. (${OUTPUT_LANGUAGE_CODES.join(", ")})`,
      },
      { status: 400 }
    );
  }

  const sessionAudio = buildSessionAudioConfig(
    targetLanguage,
    listeningMode,
    translationMode
  );

  try {
    const secretResponse = await fetch(TRANSLATION_CLIENT_SECRET_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          model: "gpt-realtime-translate",
          audio: sessionAudio,
        },
      }),
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
    });

    const secretData = (await secretResponse.json()) as {
      value?: string;
      client_secret?: { value: string };
      error?: { message?: string };
    };

    if (!secretResponse.ok) {
      const rawError = JSON.stringify({ error: secretData.error });
      return NextResponse.json(
        { error: toUserFriendlyOpenAiError(rawError) },
        { status: secretResponse.status }
      );
    }

    const clientSecret = secretData.value ?? secretData.client_secret?.value;
    if (!clientSecret) {
      return NextResponse.json(
        { error: "client secret을 받지 못했습니다." },
        { status: 500 }
      );
    }

    const sdpResponse = await fetch(TRANSLATION_CALLS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clientSecret}`,
        "Content-Type": "application/sdp",
      },
      body: sdp,
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
    });

    if (!sdpResponse.ok) {
      const errorText = await sdpResponse.text();
      return NextResponse.json(
        { error: toUserFriendlyOpenAiError(errorText) },
        { status: sdpResponse.status }
      );
    }

    const answerSdp = await sdpResponse.text();
    return NextResponse.json({ answerSdp });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json(
        {
          error:
            "OpenAI 서버 응답이 시간 초과되었습니다. 1~2분 후 다시 시도하거나 OpenAI 요청 한도와 네트워크를 확인해 주세요.",
        },
        { status: 504 }
      );
    }

    const message =
      error instanceof Error ? error.message : "알 수 없는 서버 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
