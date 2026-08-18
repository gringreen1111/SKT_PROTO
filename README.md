# 다가감 v2

한국 초등학교 입학을 앞둔 **이주배경 아동**의 학교생활 적응을 돕는 AI 친구 서비스.

v1의 화면·연출·음성 플로우는 그대로 두고, **규칙 기반 대화 엔진만 LLM 에이전트로 교체**했다.

| 항목 | 값 |
|---|---|
| 타겟 | 한국어 표준 교육과정 2~3급, 입국 1년 이내, 초등 저학년(7~9세) |
| 해결 문제 | 언어 교육이 아니라 **사회적 맥락 이해 부족으로 인한 학교생활 부적응** |
| v2 범위 | 캐릭터 설정 → 교실 준비 → 1교시 국어 발표(모둠활동 책 소개) |

## 절대 원칙

**아이에게 실패를 보여주지 않는다.** 빨간색, 에러 메시지, "틀렸어"라는 표현을 어떤 경우에도
화면에 띄우지 않는다. 인식 실패·API 실패·타임아웃은 전부
"잘 안 들렸나 봐, 한 번만 더 말해줄래?"로 흡수한다.

## 실행

```bash
npm install
npm run dev          # http://localhost:3000
```

**`ANTHROPIC_API_KEY` 없이도 전체 플로우가 끝까지 동작한다.** 키가 없으면 `RuleEngine`
(v1 키워드 사전)이 대신 답하고, 아이 화면에는 아무 표시도 하지 않는다.
팀원이 키 없이 클론해서 유저 테스트를 돌릴 수 있어야 하기 때문이다.

키를 붙이려면:

```bash
cp .env.example .env.local   # ANTHROPIC_API_KEY 채우기
```

### URL 파라미터

| 파라미터 | 효과 |
|---|---|
| `?dev=1` | 개발자 패널 — 엔진 강제 전환(auto/api/rule), 응답 원문, 지연 시간, 씬 건너뛰기 |
| `?mock=stt` | 마이크 없이 STT 목업으로 진행 |
| `?demo=1` | 목업 STT + 미리 짜인 발화로 자동 시연 |
| `?say=문장1,문장2` | 목업 STT가 말할 문장을 직접 지정 |

## 구조

```
src/
├── app/
│   ├── page.tsx                    씬 라우팅
│   └── api/
│       ├── turn/route.ts           §6.1 — 프롬프트 조립 → Anthropic → 검증 → 반환
│       └── scenario/[id]/route.ts  시나리오 JSON 서빙
├── lib/
│   ├── agents/
│   │   ├── prompts.ts              §5 시스템 프롬프트 (NPC/코치/내레이터)
│   │   └── schema.ts               §4.3 응답 스키마 (구조화 출력)
│   ├── engine/
│   │   ├── lexicon.ts              v1 키워드 사전 — 삭제 금지
│   │   ├── rule-engine.ts          폴백 겸 오프라인 엔진
│   │   ├── api-engine.ts           /api/turn 호출 + 클라이언트 타임아웃
│   │   └── validate.ts             §5.5 출력 검증
│   ├── speech/{tts,stt}.ts         §8 음성
│   ├── scenario.ts                 시나리오 로더 + 세션 랜덤
│   ├── useTurn.ts                  §4.2 오케스트레이션 (호출 1회, 시간차 재생)
│   └── store.ts                    zustand + localStorage
├── components/scenes/              Intro / Classroom / Talk / Reward
└── ../scenarios/*.json             §7 시나리오
```

## 에이전트 설계

에이전트는 **3개**(NPC · 문장 코치 · 내레이터)지만 **LLM 호출은 턴당 1회**다.
3번 순차 호출하면 응답까지 6~8초가 걸리고, 이 연령대는 3초에서 이탈한다.

```
아이가 말함
  → 즉시:   내레이터 배너 (LLM 미사용, 씬 고정 텍스트)
  → 동시에: /api/turn 1회 → JSON 하나로 coach + npc 동시 수신
  → 순차 재생: 코치 음성 → (0.6초) → NPC 음성
```

역할은 **시간차 재생으로 분리**하고, 호출은 하나로 묶는다.

### 폴백

```
ANTHROPIC_API_KEY 없음     → RuleEngine
2.5초 초과 / 네트워크 실패  → RuleEngine
JSON 파싱 실패             → RuleEngine
검증 실패(어절 수·금칙어)   → RuleEngine
```

어느 경로로 떨어지든 **아이 화면에는 아무 표시도 하지 않는다.**
폴백 여부는 `_meta.engine` 으로만 나가고, `?dev=1` 패널에서만 보인다.

### 지연 시간

`ANTHROPIC_MODEL` 기본값은 `claude-opus-5`다. Opus 5는 thinking이 기본으로 켜져 있어
2.5초 예산 안에 못 들어올 수 있고, 그러면 매 턴 조용히 `RuleEngine`으로 폴백한다
(아이 화면은 정상이지만 대사가 매번 같아진다).

`?dev=1` 패널에서 `engine=rule`이 계속 뜨면 `.env.local`에서
`ANTHROPIC_MODEL=claude-haiku-4-5`로 바꾸거나 `LLM_TIMEOUT_MS`를 올린다.

## 새 상황 추가

`scenarios/` 에 JSON 하나를 더 만들고 `src/lib/scenario.ts` 의 레지스트리에 등록하면 된다.
씬 구조는 3계층으로 나뉜다.

| 계층 | 내용 | 예 |
|---|---|---|
| 고정 제약 | 절대 안 변하는 구조 | 씬 순서, 등장인물, 미션 정의 |
| 세션 랜덤 | 실행마다 달라지는 변수 | 하늘이가 소개할 책 |
| 런타임 생성 | LLM이 그 자리에서 만드는 것 | 실제 대사, 코치 추천 문장 |

내레이터 문구는 사전 번역해서 `narratorI18n` sidecar에 둔다. **런타임 번역은 하지 않는다**
(지연·비용·품질 모두 불리). 모국어는 내레이터 배너에만 나오고,
NPC 대사와 코치 추천 문장은 한국어만 쓴다.

## 저장

서버 저장 없음. 캐릭터·진행 상황은 `localStorage`("dagagam-v2")에만 둔다.
개인정보는 이름 한 개뿐이고, 프롬프트 호칭 외의 용도로 쓰지 않는다.

## v1

`v1/index.html` — Vite로 빌드한 단일 HTML 프로토타입(2.8MB). 참고용으로 보존한다.
브라우저로 파일을 직접 열면 그대로 동작한다.
