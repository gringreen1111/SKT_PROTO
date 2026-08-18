import type { DialogueEngine, LangCode, SpeakerId, TurnInput, TurnResponse, Verdict } from "@/lib/types";
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
function npcReaction(
  speaker: SpeakerId,
  childText: string,
  state: CheckState,
): { line: string; i18n: I18nLine } {
  // 조사를 붙이기 전에 종결부호를 뗀다. 안 그러면 "읽었어.라고" 가 된다.
  const bare = childText.trim().replace(/[.!?~…]+$/, "");
  const quoted = bare.length > 18 ? `${bare.slice(0, 18)}…` : bare;

  if (state === "NO_INPUT" || state === "UNCLEAR") {
    if (speaker === "junseo") return { line: "…괜찮아. 천천히 말해도 돼.", i18n: FIXED_I18N.junseoSlow };
    if (speaker === "teacher") return { line: "괜찮아요. 한 번만 더 말해 볼까요?", i18n: FIXED_I18N.teacherAgain };
    return { line: "응? 한 번만 더 말해줄래?", i18n: FIXED_I18N.haneulAgain };
  }

  if (speaker === "junseo") {
    return state === "SUCCESS"
      ? { line: "…잘 말했어. 네 이야기 재미있었어.", i18n: FIXED_I18N.junseoPraise }
      : { line: "…응. 그 이야기 궁금해.", i18n: FIXED_I18N.junseoCurious };
  }
  if (speaker === "teacher") {
    return state === "SUCCESS"
      ? { line: "잘 말했어요. 끝까지 이야기했네요.", i18n: FIXED_I18N.teacherPraise }
      : { line: "좋아요. 천천히 말해도 돼요.", i18n: FIXED_I18N.teacherSlow };
  }

  // 하늘이 — 밝고 크게 반응한다. 받침에 맞춰 조사를 고른다.
  // 말줄임표로 잘린 인용에는 조사를 붙이지 않는다("…라고" 는 어색하다).
  const said = quoted.endsWith("…") ? quoted : withParticle(quoted, ["이라고", "라고"]);
  const pool: { line: string; i18n: I18nLine }[] = [
    { line: `오~ “${quoted}”! 나도 그 책 읽어보고 싶다 ✨`, i18n: QUOTED_I18N.wantRead(quoted) },
    { line: `“${quoted}”… 응, 무슨 말인지 알겠어 😊`, i18n: QUOTED_I18N.understand(quoted) },
    { line: `“${said}” 했구나! 고마워 😄`, i18n: QUOTED_I18N.thanks(quoted) },
    { line: `아하, “${quoted}”! 좋은데? 👍`, i18n: QUOTED_I18N.nice(quoted) },
  ];
  // 발화 길이로 고정 선택 — 같은 입력에 같은 반응이 나와야 폴백인 걸 들키지 않는다.
  return pool[childText.length % pool.length];
}

/**
 * 폴백 대사의 가정언어 번역.
 *
 * 뜻이 대충 통하는 다른 문장을 붙이면 안 된다 — 아이는 한국어가 이해 안 될 때
 * 이걸 누르는 거라, 다른 말이 나오면 없느니만 못하다.
 * 그래서 대사 하나하나에 짝을 맞춰 두고, 아이가 한 말은 그대로 끼워 넣는다.
 *
 * LLM 경로는 lineI18n 을 같은 응답에 실어 받는다.
 */
type Foreign = Exclude<LangCode, "ko">;
type I18nLine = Record<Foreign, string>;

const fixed = (vi: string, zh: string, ru: string, tl: string): I18nLine => ({ vi, zh, ru, tl });
const quoting = (fn: (q: string) => I18nLine) => fn;

/** 아이가 한 말을 그대로 인용하는 대사들. */
const QUOTED_I18N = {
  wantRead: quoting((q) => ({
    vi: `Ồ~ “${q}”! Mình cũng muốn đọc cuốn đó ✨`,
    zh: `哇~“${q}”！我也想读那本书 ✨`,
    ru: `О, «${q}»! Я тоже хочу почитать ✨`,
    tl: `Uy~ “${q}”! Gusto ko ring basahin iyon ✨`,
  })),
  understand: quoting((q) => ({
    vi: `“${q}”… Ừ, mình hiểu rồi 😊`,
    zh: `“${q}”…嗯，我明白了 😊`,
    ru: `«${q}»… Да, я понял 😊`,
    tl: `“${q}”… Ah, naintindihan ko 😊`,
  })),
  thanks: quoting((q) => ({
    vi: `Cậu nói “${q}” à! Cảm ơn cậu 😄`,
    zh: `你说“${q}”呀！谢谢你 😄`,
    ru: `Ты сказал «${q}»! Спасибо 😄`,
    tl: `“${q}” pala! Salamat 😄`,
  })),
  nice: quoting((q) => ({
    vi: `A ha, “${q}”! Hay đấy 👍`,
    zh: `啊哈，“${q}”！不错嘛 👍`,
    ru: `Ага, «${q}»! Здорово 👍`,
    tl: `Ahh, “${q}”! Ang galing 👍`,
  })),
} as const;

/** 인용이 없는 고정 대사들. */
const FIXED_I18N = {
  junseoSlow: fixed(
    "…Không sao. Cậu nói từ từ cũng được.",
    "…没关系。慢慢说也可以。",
    "…Ничего. Можешь говорить медленно.",
    "…Okay lang. Puwedeng dahan-dahan.",
  ),
  teacherAgain: fixed(
    "Không sao đâu. Nói lại một lần nữa nhé?",
    "没关系。再说一次好吗？",
    "Ничего страшного. Скажешь ещё раз?",
    "Okay lang. Ulitin natin?",
  ),
  haneulAgain: fixed(
    "Ơ? Cậu nói lại một lần nữa nhé?",
    "嗯？可以再说一次吗？",
    "А? Скажешь ещё разок?",
    "Ha? Pwede mong ulitin?",
  ),
  junseoPraise: fixed(
    "…Cậu nói hay lắm. Câu chuyện của cậu thú vị.",
    "…说得很好。你的故事很有趣。",
    "…Хорошо рассказал. Мне было интересно.",
    "…Ang galing mo. Nakakatuwa ang kwento mo.",
  ),
  junseoCurious: fixed(
    "…Ừ. Mình tò mò về chuyện đó.",
    "…嗯。我很好奇那个故事。",
    "…Да. Мне интересна эта история.",
    "…Oo. Gusto kong marinig iyon.",
  ),
  teacherPraise: fixed(
    "Cậu nói hay lắm. Đã kể hết đến cuối rồi.",
    "说得很好。你说到最后了。",
    "Хорошо рассказал. Довёл до конца.",
    "Ang galing. Natapos mo ang kwento.",
  ),
  teacherSlow: fixed(
    "Tốt lắm. Nói từ từ cũng được.",
    "很好。慢慢说也可以。",
    "Хорошо. Можно говорить не спеша.",
    "Mabuti. Puwedeng dahan-dahan.",
  ),
} as const;

function pick(i18n: I18nLine, lang: LangCode): string | null {
  return lang === "ko" ? null : (i18n[lang] ?? null);
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

    const reaction = npcReaction(speaker, result.text, result.state);

    return {
      coach: {
        verdict,
        recast: recastOf(result.state, result.keywords),
        suggestions,
        speakIndex: verdict === "complete" ? null : 0,
      },
      npc: {
        speaker,
        line: reaction.line,
        lineI18n: pick(reaction.i18n, input.homeLanguage),
        emotion: speaker === "junseo" ? "shy" : verdict === "complete" ? "happy" : "curious",
      },
      narratorHint: null,
      missionCleared: verdict === "complete" ? (input.sessionVars?.mission ?? null) : null,
    };
  }
}

export const ruleEngine = new RuleEngine();
