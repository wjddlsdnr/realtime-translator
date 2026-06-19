import { NextResponse } from "next/server";
import { getLanguageLabel, isSupportedOutputLanguage } from "@/lib/languages";
import type { LanguageCode } from "@/lib/languages";

type TranslateRequestBody = {
  text?: string;
  sourceLang?: LanguageCode;
  targetLang?: LanguageCode;
};

/** 메시지 단위 텍스트 번역. 방향은 요청마다 sourceLang/targetLang으로 결정합니다. */
export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "서버에 OPENAI_API_KEY가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  let body: TranslateRequestBody;
  try {
    body = (await request.json()) as TranslateRequestBody;
  } catch {
    return NextResponse.json(
      { error: "요청 본문을 읽을 수 없습니다." },
      { status: 400 }
    );
  }

  const text = body.text?.trim();
  const sourceLang = body.sourceLang;
  const targetLang = body.targetLang;

  if (!text) {
    return NextResponse.json({ error: "번역할 문장이 없습니다." }, { status: 400 });
  }

  if (!sourceLang || !targetLang) {
    return NextResponse.json(
      { error: "sourceLang과 targetLang이 필요합니다." },
      { status: 400 }
    );
  }

  if (!isSupportedOutputLanguage(sourceLang) || !isSupportedOutputLanguage(targetLang)) {
    return NextResponse.json({ error: "지원하지 않는 언어입니다." }, { status: 400 });
  }

  if (sourceLang === targetLang) {
    return NextResponse.json({ translatedText: text });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content:
              "You are a translation engine. Translate faithfully without adding, omitting, or rewriting content. Do not complete partial sentences or change the speaker's meaning. Return only the translated sentence(s), with no explanation.",
          },
          {
            role: "user",
            content: `Translate from ${getLanguageLabel(sourceLang)} to ${getLanguageLabel(targetLang)}:\n\n${text}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message ?? "번역에 실패했습니다." },
        { status: response.status }
      );
    }

    const translatedText = data.choices?.[0]?.message?.content?.trim();
    if (!translatedText) {
      return NextResponse.json({ error: "번역 결과가 비어 있습니다." }, { status: 500 });
    }

    return NextResponse.json({ translatedText });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({ error: "번역 요청이 시간 초과되었습니다." }, { status: 504 });
    }

    const message = error instanceof Error ? error.message : "알 수 없는 서버 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
