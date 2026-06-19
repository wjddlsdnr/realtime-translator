import { NextResponse } from "next/server";
import { toUserFriendlyOpenAiError } from "@/lib/openaiErrors";
import { isSupportedOutputLanguage } from "@/lib/languages";
import type { LanguageCode } from "@/lib/languages";

const TRANSLATION_CLIENT_SECRET_URL =
  "https://api.openai.com/v1/realtime/translations/client_secrets";

type SessionRequestBody = {
  targetLanguage?: LanguageCode;
};

/** OpenAI Realtime Translation용 단기 client secret을 발급합니다. */
export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "서버에 OPENAI_API_KEY가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  let body: SessionRequestBody = {};
  try {
    body = (await request.json()) as SessionRequestBody;
  } catch {
    body = {};
  }

  const targetLanguage = body.targetLanguage ?? "ko";

  if (!isSupportedOutputLanguage(targetLanguage)) {
    return NextResponse.json(
      { error: "지원하지 않는 출력 언어입니다." },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(TRANSLATION_CLIENT_SECRET_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          model: "gpt-realtime-translate",
          audio: {
            input: {
              transcription: { model: "gpt-realtime-whisper" },
              noise_reduction: { type: "near_field" },
            },
            output: { language: targetLanguage },
          },
        },
      }),
    });

    const data = (await response.json()) as {
      value?: string;
      client_secret?: { value: string };
      error?: { message?: string };
    };

    if (!response.ok) {
      const rawError = JSON.stringify({ error: data.error });
      return NextResponse.json(
        {
          error: toUserFriendlyOpenAiError(rawError),
        },
        { status: response.status }
      );
    }

    const clientSecret = data.value ?? data.client_secret?.value;

    if (!clientSecret) {
      return NextResponse.json(
        { error: "client secret을 받지 못했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ clientSecret });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 서버 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
