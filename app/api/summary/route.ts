import { NextResponse } from "next/server";
import {
  SUMMARY_SYSTEM_PROMPT,
  buildSummaryUserPrompt,
} from "@/lib/summaryPrompt";
import type { SummaryRequestBody, SummaryResult } from "@/lib/types";

/** 대화 기록을 바탕으로 AI 요약을 생성합니다. */
export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "서버에 OPENAI_API_KEY가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  let body: SummaryRequestBody;
  try {
    body = (await request.json()) as SummaryRequestBody;
  } catch {
    return NextResponse.json(
      { error: "요청 본문을 읽을 수 없습니다." },
      { status: 400 }
    );
  }

  if (!body.entries?.length) {
    return NextResponse.json(
      { error: "요약할 대화 기록이 없습니다." },
      { status: 400 }
    );
  }

  const userPrompt = buildSummaryUserPrompt(
    body.entries,
    body.sourceLanguage,
    body.targetLanguage
  );

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
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SUMMARY_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data.error?.message ?? "OpenAI 요약 생성에 실패했습니다.",
        },
        { status: response.status }
      );
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "요약 결과가 비어 있습니다." },
        { status: 500 }
      );
    }

    const summary = JSON.parse(content) as SummaryResult;
    return NextResponse.json({ summary });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 서버 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
