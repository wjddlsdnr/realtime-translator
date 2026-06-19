# 실시간 음성 번역기

해외여행, 국제 미팅, 바이오 미팅 등에서 언어 장벽을 줄이기 위한 **실시간 음성 번역 + 대화 기록 + AI 요약** 웹앱입니다.

휴대폰 브라우저에서 상대방의 외국어 음성을 마이크로 듣고, OpenAI `gpt-realtime-translate`로 실시간 한국어 번역 음성과 자막을 제공합니다.

## 주요 기능

- English → Korean 실시간 음성 번역 (Listening Mode)
- 한국어 번역 음성 자동 재생
- 원문 / 번역 자막 실시간 표시
- 대화 텍스트 자동 기록 (localStorage)
- AI 요약 생성 (핵심 내용, Action Items, 바이오 용어 등)
- 대화 기록 TXT / JSON보내기
- 기록 초기화

## 기술 스택

- Next.js App Router
- TypeScript
- WebRTC
- OpenAI Realtime Translation API (`gpt-realtime-translate`)
- OpenAI Chat Completions API (요약)

## 설치 방법

```bash
npm install
```

## 환경변수 설정

`.env.local.example`을 복사해 `.env.local`을 만듭니다.

```bash
copy .env.local.example .env.local
```

`.env.local`에 OpenAI API 키를 입력합니다.

```env
OPENAI_API_KEY=sk-...
```

> **중요:** API 키는 서버에서만 사용됩니다. 브라우저에는 ephemeral client secret만 전달됩니다.

## 로컬 실행

```bash
npm run dev
```

PC 브라우저에서 `http://localhost:3000` 접속

## 휴대폰에서 테스트하는 방법

1. PC와 휴대폰이 같은 Wi-Fi에 연결되어 있어야 합니다.
2. PC의 로컬 IP를 확인합니다. (예: `192.168.0.10`)
3. 휴대폰 브라우저에서 `http://192.168.0.10:3000` 접속

## HTTPS 테스트 방법 (모바일 마이크 권한)

모바일 브라우저는 마이크 사용을 위해 **HTTPS**가 필요한 경우가 많습니다.

### ngrok 예시

```bash
npx ngrok http 3000
```

생성된 `https://...ngrok-free.app` URL을 휴대폰에서 엽니다.

### Cloudflare Tunnel 예시

```bash
cloudflared tunnel --url http://localhost:3000
```

## 사용 방법

1. 앱 접속 후 상대방 동의 안내를 확인합니다.
2. 입력 언어(참고용)와 출력 언어를 선택합니다.
3. **이어폰**을 연결하는 것을 권장합니다.
4. **시작** 버튼을 눌러 마이크 권한을 허용합니다.
5. 상대방이 영어로 말하면 한국어 번역 음성과 자막이 표시됩니다.
6. **정지** 버튼으로 마이크와 WebRTC 연결을 종료합니다.
7. 미팅 후 **AI 요약 생성**으로 핵심 내용을 정리합니다.
8. 필요 시 대화 기록을 TXT/JSON으로보냅니다.

## 개인정보 및 동의 관련 주의사항

- 상대방의 동의 없이 대화를 녹음/기록하지 마세요.
- 초기 버전은 **음성 원본 파일을 저장하지 않고** 텍스트 기록만 저장합니다.
- 기록은 브라우저 localStorage에 저장됩니다.

## 프로젝트 구조

```text
app/
  page.tsx
  layout.tsx
  globals.css
  api/
    session/route.ts    # Realtime client secret 발급
    summary/route.ts      # AI 요약 생성
components/
  TranslatorPanel.tsx
  LanguageSelector.tsx
  TranscriptView.tsx
  ConversationLog.tsx
  SummaryPanel.tsx
  StatusBadge.tsx
lib/
  realtime.ts
  storage.ts
  types.ts
  summaryPrompt.ts
  download.ts
```

## 향후 개선 계획

- Korean → English 말하기 모드
- 양방향 자동 통역
- 여행 / 미팅 / 바이오 미팅 모드
- 바이오 전문용어 glossary
- Supabase / PostgreSQL 등 클라우드 DB 연동
- 회의록 PDF보내기
- 사용자 계정별 기록 관리

## 라이선스

MIT
