/** 앱 전역 공용 타입. §4.3 응답 스키마가 여기 산다. */

export type LangCode = "vi" | "zh" | "ru" | "tl" | "ko";
export type SpeakerId = "haneul" | "junseo" | "teacher";
export type Emotion = "happy" | "curious" | "calm" | "shy";
export type Verdict = "complete" | "partial" | "unclear";

/** 다국어 sidecar. 내레이터 배너에만 쓰인다 — NPC 대사는 한국어만. */
export type I18n = Record<LangCode, string>;

/** §4.3 — 턴당 LLM 호출 1회로 받아오는 전체 응답. */
export interface TurnResponse {
  coach: {
    verdict: Verdict;
    /** 어눌한 문장 → 완전한 문장. verdict === "complete" 이면 null. */
    recast: string | null;
    /** 정확히 2개. 길이가 서로 달라야 한다. */
    suggestions: string[];
    /** 음성으로 읽어줄 suggestion 인덱스. 없으면 null. */
    speakIndex: number | null;
  };
  npc: {
    speaker: SpeakerId;
    /** 1~2문장, 각 8어절 이내. */
    line: string;
    /**
     * 말풍선을 눌렀을 때 보여줄 아이의 가정언어 번역.
     * 별도 번역 호출을 하지 않으려고 같은 응답에 실어 받는다(§7 런타임 번역 금지).
     * 없으면 말풍선에 번역 버튼을 띄우지 않는다 — 빈 화면을 보여주지 않기 위함.
     */
    lineI18n: string | null;
    emotion: Emotion;
  };
  /** 예의범절 안내가 필요할 때만. 그 외 null. */
  narratorHint: string | null;
  /** 미션 id 또는 null. */
  missionCleared: string | null;
}

export interface Turn {
  role: "child" | "npc";
  speaker?: SpeakerId;
  text: string;
}

export interface TurnInput {
  scenarioId: string;
  sceneId: string;
  childName: string;
  homeLanguage: LangCode;
  transcript: string;
  sttConfidence: number;
  history: Turn[];
  /** 세션 랜덤 변수(하늘이 책 등). 프롬프트 조립에 쓴다. */
  sessionVars?: Record<string, string>;
}

/** §6.2 — 엔진 추상화. RuleEngine / ApiEngine 이 이걸 구현한다. */
export interface DialogueEngine {
  readonly name: "rule" | "api";
  turn(input: TurnInput): Promise<TurnResponse>;
}

/* ── 시나리오 JSON (§7) ── */

export interface ScenarioMission {
  id: string;
  label: string;
  desc: string;
}

export interface ScenarioScene {
  id: string;
  goal: string;
  narrator: string;
  narratorI18n?: Partial<I18n>;
  sessionVars?: Record<string, string[]>;
  npcTurn?: { speaker: SpeakerId; intent: string };
  childTurn: boolean;
  childGoal?: string;
  clears?: string;
}

export interface Scenario {
  id: string;
  title: string;
  characters: SpeakerId[];
  missions: ScenarioMission[];
  scenes: ScenarioScene[];
}
