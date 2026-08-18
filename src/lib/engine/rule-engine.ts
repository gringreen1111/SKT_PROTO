import type { DialogueEngine, SpeakerId, TurnInput, TurnResponse, Verdict } from "@/lib/types";
import { FALLBACK_LINES, matchLexicon, suggestionsFor, withParticle, type LexEntry } from "./lexicon";

/**
 * v1 규칙 기반 엔진. §3 절대 삭제 금지 — LLM 실패·타임아웃 시 폴백 경로다.
 * 아이 입장에서는 폴백이 돌아도 앱이 정상 동작하는 것처럼 보여야 한다.
 *
 * 서버와 브라우저 양쪽에서 돈다(오프라인 모드 겸용).
 */

/** 종결어미. 있으면 "문장을 말했다"고 본다. */
const ENDING = /(습니다|ㅂ니다|입니다|이에요|예요|에요|어요|아요|해요|이야|야|이다|다|어|아|여|요|자|까|니|네|지|워|해|같아|좋아|어때|볼래|을래|ㄹ래)[.!?~…\s]*$/;
/** 조사. 어절에 붙어 있으면 문장 완성도를 높게 본다. */
const PARTICLE = /(은|는|이|가|을|를|에게|에서|에|으로|로|와|과|랑|이랑|도|만|보다|처럼)$/;

export type CheckState = "NO_INPUT" | "SUCCESS" | "KEYWORD_ONLY" | "UNCLEAR";

export interface CheckResult {
  state: CheckState;
  text: string;
  keywords: LexEntry[];
  words: number;
  /** ?dev=1 패널에 띄우는 판정 근거. 아이 화면에는 절대 안 나온다. */
  reason: string;
}

/** v1 판정기. 정확 일치가 아니라 키워드 포함 여부로 본다. */
export function check(raw: string | null | undefined): CheckResult {
  const text = (raw ?? "").trim();
  if (!text) return { state: "NO_INPUT", text: "", keywords: [], words: 0, reason: "인식 결과 없음" };

  const words = text.split(/\s+/).filter(Boolean);
  const keywords = matchLexicon(text);
  const hasEnding = ENDING.test(text);
  const hasParticle = words.some((w) => w.length >= 2 && PARTICLE.test(w.replace(/[.!?~…]/g, "")));

  if (hasEnding && (words.length >= 3 || (words.length >= 2 && hasParticle))) {
    return {
      state: "SUCCESS",
      text,
      keywords,
      words: words.length,
      reason: `종결어미 O · ${words.length}어절${hasParticle ? " · 조사 O" : ""}`,
    };
  }
  if (keywords.length > 0) {
    return {
      state: "KEYWORD_ONLY",
      text,
      keywords,
      words: words.length,
      reason: `사전 매칭 [${keywords.map((k) => k.word).join(", ")}] · 문장 미완성`,
    };
  }
  return { state: "UNCLEAR", text, keywords: [], words: words.length, reason: "사전 매칭 실패" };
}

/** 아이가 쓴 단어를 되받아 쓰는 NPC 반응. §5.2 "듣고 있다"는 신호. */
function npcReaction(speaker: SpeakerId, childText: string, state: CheckState): string {
  const quoted = childText.length > 18 ? `${childText.slice(0, 18)}…` : childText;

  if (state === "NO_INPUT" || state === "UNCLEAR") {
    if (speaker === "junseo") return "…괜찮아. 천천히 말해도 돼.";
    if (speaker === "teacher") return "괜찮아요. 한 번만 더 말해 볼까요?";
    return "응? 한 번만 더 말해줄래?";
  }

  if (speaker === "junseo") {
    return state === "SUCCESS" ? "…잘 말했어. 네 이야기 재미있었어." : "…응. 그 이야기 궁금해.";
  }
  if (speaker === "teacher") {
    return state === "SUCCESS" ? "잘 말했어요. 끝까지 이야기했네요." : "좋아요. 천천히 말해도 돼요.";
  }
  // 하늘이 — 밝고 크게 반응한다. 받침에 맞춰 조사를 고른다.
  const said = withParticle(quoted, ["이라고", "라고"]);
  const pool = [
    `오~ “${quoted}”! 나도 그 책 읽어보고 싶다 ✨`,
    `“${quoted}”… 응, 무슨 말인지 알겠어 😊`,
    `“${said}” 했구나! 고마워 😄`,
    `아하, “${quoted}”! 좋은데? 👍`,
  ];
  // 발화 길이로 고정 선택 — 같은 입력에 같은 반응이 나와야 폴백인 걸 들키지 않는다.
  return pool[childText.length % pool.length];
}

function verdictOf(state: CheckState, confidence: number): Verdict {
  if (confidence < 0.6) return "unclear";
  if (state === "SUCCESS") return "complete";
  if (state === "KEYWORD_ONLY") return "partial";
  return "unclear";
}

/** 어눌한 문장을 자연스럽게 되돌려준다. 문법 설명은 하지 않는다. */
function recastOf(state: CheckState, keywords: LexEntry[]): string | null {
  if (state === "SUCCESS") return null;
  const kw = keywords[0];
  if (!kw) return null;
  const w = kw.kind === "noun" ? kw.word : kw.word;
  return `아, ${w} 이야기구나!`;
}

export class RuleEngine implements DialogueEngine {
  readonly name = "rule" as const;

  async turn(input: TurnInput): Promise<TurnResponse> {
    const result = check(input.transcript);
    const confidence = input.sttConfidence;
    const verdict = verdictOf(result.state, confidence);

    const lines =
      result.keywords.length > 0 ? suggestionsFor(result.keywords[0]) : FALLBACK_LINES;
    const suggestions = lines.slice(0, 2).map((l) => l.ko);
    // FALLBACK_LINES 는 3개라 2개로 자른다. 항상 정확히 2개여야 한다(§5.3).
    while (suggestions.length < 2) suggestions.push(FALLBACK_LINES[suggestions.length].ko);

    const speaker: SpeakerId = (["haneul", "junseo", "teacher"] as const).includes(
      (input.sessionVars?.speaker ?? "") as SpeakerId,
    )
      ? (input.sessionVars!.speaker as SpeakerId)
      : "haneul";

    return {
      coach: {
        verdict,
        recast: recastOf(result.state, result.keywords),
        suggestions,
        speakIndex: verdict === "complete" ? null : 0,
      },
      npc: {
        speaker,
        line: npcReaction(speaker, result.text, result.state),
        emotion: speaker === "junseo" ? "shy" : verdict === "complete" ? "happy" : "curious",
      },
      narratorHint: null,
      missionCleared: verdict === "complete" ? (input.sessionVars?.mission ?? null) : null,
    };
  }
}

export const ruleEngine = new RuleEngine();
