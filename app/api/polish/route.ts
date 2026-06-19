import { NextResponse } from "next/server";
import { getOpenAIApiKey } from "@/lib/openaiApiKey";
import {
  buildPolishSystemPrompt,
  buildPolishUserPrompt,
} from "@/lib/polishPrompt";
import type { LanguageCode } from "@/lib/types";

type PolishRequestBody = {
  originalText?: string;
  translatedText?: string;
  sourceLanguage?: LanguageCode;
  targetLanguage?: LanguageCode;
};

/** 실시간 번역 초안을 자연스러운 문장으로 다듬습니다. */
export async function POST(request: Request) {
  const apiKey = getOpenAIApiKey();

  if (!apiKey) {
    return NextResponse.json(
      { error: "서버에 OPENAI_API_KEY가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  let body: PolishRequestBody;
  try {
    body = (await request.json()) as PolishRequestBody;
  } catch {
    return NextResponse.json(
      { error: "요청 본문을 읽을 수 없습니다." },
      { status: 400 }
    );
  }

  const translatedText = body.translatedText?.trim();
  if (!translatedText) {
    return NextResponse.json(
      { error: "다듬을 번역문이 없습니다." },
      { status: 400 }
    );
  }

  const sourceLanguage = body.sourceLanguage ?? "en";
  const targetLanguage = body.targetLanguage ?? "ko";
  const originalText = body.originalText?.trim() ?? "";

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 300,
        messages: [
          { role: "system", content: buildPolishSystemPrompt(targetLanguage) },
          {
            role: "user",
            content: buildPolishUserPrompt(
              originalText,
              translatedText,
              sourceLanguage,
              targetLanguage
            ),
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
        { error: data.error?.message ?? "문장 다듬기에 실패했습니다." },
        { status: response.status }
      );
    }

    const polishedText = data.choices?.[0]?.message?.content?.trim();
    if (!polishedText) {
      return NextResponse.json(
        { error: "다듬은 문장이 비어 있습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ polishedText });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json(
        { error: "문장 다듬기가 시간 초과되었습니다." },
        { status: 504 }
      );
    }

    const message =
      error instanceof Error ? error.message : "알 수 없는 서버 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
