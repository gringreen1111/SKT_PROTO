import type { Emotion, SpeakerId, TurnResponse, Verdict } from "@/lib/types";

/**
 * §5.5 출력 검증 — LLM 응답을 아이에게 전달하기 전에 반드시 통과시킨다.
 * 하나라도 걸리면 폴백(RuleEngine)으로 대체하고, 아이에게는 어떤 표시도 하지 않는다.
 */

const SPEAKERS: SpeakerId[] = ["haneul", "junseo", "teacher"];
const EMOTIONS: Emotion[] = ["happy", "curious", "calm", "shy"];
const VERDICTS: Verdict[] = ["complete", "partial", "unclear"];

/** 어절 수 상한. 목표는 8어절, 검증은 여유 2어절을 둔 10어절. */
const MAX_EOJEOL = 10;

/**
 * 금칙어 필터. 폭력·성·비하·국적 언급.
 * 아이 화면에 나가면 안 되는 말이 하나라도 섞이면 통째로 폴백한다.
 */
const BANNED = [
  // 폭력·죽음
  "죽어", "죽여", "죽었", "때려", "때리", "칼", "총", "피가", "자살", "폭력",
  // 비하·차별
  "바보", "멍청", "못생", "병신", "찐따", "틀렸", "잘못했", "이상해", "못해",
  // 국적·출신 언급 (§5.1 금지)
  "외국인", "이주민", "다문화", "너희 나라", "너네 나라", "고향에서는", "한국말 못",
  // 성·종교·정치
  "섹스", "야한", "종교", "하나님", "부처", "대통령", "정치",
];

export interface ValidationFailure {
  ok: false;
  reason: string;
}
export interface ValidationSuccess {
  ok: true;
  value: TurnResponse;
}
export type ValidationResult = ValidationSuccess | ValidationFailure;

/** 어절 수. 공백 기준. */
export function eojeolCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function containsBanned(s: string): string | null {
  const flat = s.replace(/\s/g, "");
  for (const w of BANNED) {
    if (flat.includes(w.replace(/\s/g, ""))) return w;
  }
  return null;
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

/** 1) JSON 스키마 파싱 → 2) 어절 수 → 3) 금칙어 → 4) suggestions 2개 */
export function validateTurnResponse(raw: unknown, allowedMission: string | null): ValidationResult {
  if (typeof raw !== "object" || raw === null) return { ok: false, reason: "응답이 객체가 아님" };
  const r = raw as Record<string, unknown>;

  // ── coach ──
  const coach = r.coach as Record<string, unknown> | undefined;
  if (!coach || typeof coach !== "object") return { ok: false, reason: "coach 없음" };

  const verdict = coach.verdict;
  if (!isString(verdict) || !VERDICTS.includes(verdict as Verdict)) {
    return { ok: false, reason: `coach.verdict 값 오류: ${String(verdict)}` };
  }

  const recast = coach.recast === null || coach.recast === undefined ? null : coach.recast;
  if (recast !== null && !isString(recast)) return { ok: false, reason: "coach.recast 타입 오류" };

  const suggestions = coach.suggestions;
  if (!Array.isArray(suggestions) || suggestions.length !== 2 || !suggestions.every(isString)) {
    return { ok: false, reason: `coach.suggestions 는 문자열 2개여야 함 (받은 값: ${JSON.stringify(suggestions)})` };
  }

  let speakIndex = coach.speakIndex;
  if (speakIndex === undefined) speakIndex = null;
  if (speakIndex !== null && speakIndex !== 0 && speakIndex !== 1) {
    return { ok: false, reason: `coach.speakIndex 값 오류: ${String(speakIndex)}` };
  }

  // ── npc ──
  const npc = r.npc as Record<string, unknown> | undefined;
  if (!npc || typeof npc !== "object") return { ok: false, reason: "npc 없음" };

  const speaker = npc.speaker;
  if (!isString(speaker) || !SPEAKERS.includes(speaker as SpeakerId)) {
    return { ok: false, reason: `npc.speaker 값 오류: ${String(speaker)}` };
  }

  const line = npc.line;
  if (!isString(line) || !line.trim()) return { ok: false, reason: "npc.line 비어 있음" };

  // 번역은 있으면 쓰고 없으면 만다. 번역 하나 때문에 턴 전체를 폴백시키지 않는다.
  const rawI18n = npc.lineI18n;
  const lineI18n = isString(rawI18n) && rawI18n.trim() ? rawI18n.trim() : null;

  const emotion = npc.emotion;
  if (!isString(emotion) || !EMOTIONS.includes(emotion as Emotion)) {
    return { ok: false, reason: `npc.emotion 값 오류: ${String(emotion)}` };
  }

  // ── 2) 어절 수 (npc.line 은 문장별로, suggestions 는 문장 전체로) ──
  for (const sentence of line.split(/(?<=[.!?…])\s+/).filter(Boolean)) {
    if (eojeolCount(sentence) > MAX_EOJEOL) {
      return { ok: false, reason: `npc.line 문장이 ${eojeolCount(sentence)}어절 (상한 ${MAX_EOJEOL})` };
    }
  }
  for (const s of suggestions) {
    if (!s.trim()) return { ok: false, reason: "suggestions 에 빈 문자열" };
    if (eojeolCount(s) > MAX_EOJEOL) {
      return { ok: false, reason: `suggestion 이 ${eojeolCount(s)}어절 (상한 ${MAX_EOJEOL})` };
    }
  }

  // ── narratorHint ──
  const narratorHint = r.narratorHint === undefined ? null : r.narratorHint;
  if (narratorHint !== null && !isString(narratorHint)) return { ok: false, reason: "narratorHint 타입 오류" };

  // ── 3) 금칙어 ──
  const corpus = [line, ...suggestions, recast ?? "", (narratorHint as string | null) ?? ""].join(" ");
  const hit = containsBanned(corpus);
  if (hit) return { ok: false, reason: `금칙어 적발: ${hit}` };

  // ── missionCleared 는 이 씬에서 허용된 id 만 통과 ──
  const rawMission = r.missionCleared === undefined ? null : r.missionCleared;
  if (rawMission !== null && !isString(rawMission)) return { ok: false, reason: "missionCleared 타입 오류" };
  const missionCleared = rawMission === allowedMission ? allowedMission : null;

  return {
    ok: true,
    value: {
      coach: {
        verdict: verdict as Verdict,
        recast: verdict === "complete" ? null : ((recast as string | null) ?? null),
        suggestions: suggestions as [string, string],
        speakIndex: verdict === "complete" ? null : ((speakIndex as 0 | 1 | null) ?? null),
      },
      npc: {
        speaker: speaker as SpeakerId,
        line: line.trim(),
        lineI18n,
        emotion: emotion as Emotion,
      },
      narratorHint: (narratorHint as string | null) ?? null,
      missionCleared,
    },
  };
}

/** 모델이 코드펜스를 붙였거나 앞뒤에 말을 덧댔을 때 JSON만 건져낸다. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("JSON 객체를 찾지 못함");
  return JSON.parse(body.slice(start, end + 1));
}
