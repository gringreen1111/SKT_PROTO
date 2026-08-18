import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";

import { buildSystemPrompt, buildUserPrompt } from "@/lib/agents/prompts";
import { TurnSchema } from "@/lib/agents/schema";
import { ruleEngine } from "@/lib/engine/rule-engine";
import { extractJson, validateTurnResponse } from "@/lib/engine/validate";
import { getScenario, getScene } from "@/lib/scenario";
import type { LangCode, TurnInput, TurnResponse } from "@/lib/types";

/**
 * §6.1 POST /api/turn
 * 시나리오 로드 → 프롬프트 조립 → Anthropic 호출 → 검증 → 반환.
 * API 키는 서버 환경변수에만 존재한다. 클라이언트로 절대 나가지 않는다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** §4.4 지연 시간 예산 — 2.5초 넘으면 RuleEngine 결과를 쓴다. */
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 2500);
const DEFAULT_MODEL = "claude-opus-5";

/**
 * effort 를 low 로 둔다. 이 턴의 출력은 짧은 JSON 하나뿐이고,
 * §4.4 예산이 2.5초라 깊게 생각할 시간이 없다.
 * temperature 는 보내지 않는다 — Opus 5 / Sonnet 5 계열에서 400이다.
 */
const EFFORT = "low" as const;

const LANGS: LangCode[] = ["vi", "zh", "ru", "tl", "ko"];

export interface TurnMeta {
  engine: "rule" | "api";
  /** 폴백했다면 그 이유. ?dev=1 패널에만 쓴다. 아이 화면에는 절대 안 나온다. */
  fallbackReason: string | null;
  latencyMs: number;
}

function parseInput(body: unknown): TurnInput | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const scenarioId = typeof b.scenarioId === "string" ? b.scenarioId : null;
  const sceneId = typeof b.sceneId === "string" ? b.sceneId : null;
  if (!scenarioId || !sceneId) return null;

  const lang =
    typeof b.homeLanguage === "string" && LANGS.includes(b.homeLanguage as LangCode)
      ? (b.homeLanguage as LangCode)
      : "ko";

  return {
    scenarioId,
    sceneId,
    childName: typeof b.childName === "string" ? b.childName.slice(0, 8) : "",
    homeLanguage: lang,
    transcript: typeof b.transcript === "string" ? b.transcript.slice(0, 400) : "",
    sttConfidence: typeof b.sttConfidence === "number" ? b.sttConfidence : 1,
    history: Array.isArray(b.history) ? (b.history.slice(-10) as TurnInput["history"]) : [],
    sessionVars:
      typeof b.sessionVars === "object" && b.sessionVars !== null
        ? (b.sessionVars as Record<string, string>)
        : {},
  };
}

/**
 * 턴당 호출 1회(§4.2). 구조화 출력으로 §4.3 스키마를 API 레벨에서 강제한다.
 * parsed_output 이 null 이면 텍스트를 직접 파싱하는 경로로 떨어진다.
 */
async function callAnthropic(
  client: Anthropic,
  system: string,
  user: string,
  signal: AbortSignal,
): Promise<unknown> {
  const message = await client.messages.parse(
    {
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: user }],
      output_config: {
        effort: EFFORT,
        format: zodOutputFormat(TurnSchema),
      },
    },
    { signal },
  );

  if (message.parsed_output) return message.parsed_output;

  // 스키마 파싱이 실패했을 때만 원문에서 JSON을 건져낸다.
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

export async function POST(request: Request) {
  const started = Date.now();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const input = parseInput(body);
  if (!input) return NextResponse.json({ error: "bad input" }, { status: 400 });

  const scenario = getScenario(input.scenarioId);
  const scene = scenario ? getScene(scenario, input.sceneId) : null;

  // 씬 정보를 규칙 엔진에도 실어 준다. 폴백해도 같은 인물이 같은 미션으로 말한다.
  const engineInput: TurnInput = {
    ...input,
    sessionVars: {
      ...input.sessionVars,
      ...(scene?.npcTurn ? { speaker: scene.npcTurn.speaker } : {}),
      ...(scene?.clears ? { mission: scene.clears } : {}),
    },
  };

  /** 어떤 실패든 여기로 흡수된다. 아이 화면에는 아무 표시도 하지 않는다. */
  const fallback = async (reason: string) => {
    const value = await ruleEngine.turn(engineInput);
    const meta: TurnMeta = { engine: "rule", fallbackReason: reason, latencyMs: Date.now() - started };
    return NextResponse.json({ ...value, _meta: meta } satisfies TurnResponse & { _meta: TurnMeta });
  };

  if (!scenario || !scene) return fallback(`시나리오/씬 없음: ${input.scenarioId}/${input.sceneId}`);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback("ANTHROPIC_API_KEY 없음");

  const system = buildSystemPrompt({
    childName: input.childName,
    homeLanguage: input.homeLanguage,
    scene,
    sessionVars: input.sessionVars ?? {},
    missionId: scene.clears ?? null,
  });
  const user = buildUserPrompt({
    transcript: input.transcript,
    sttConfidence: input.sttConfidence,
    history: input.history,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    // 재시도하지 않는다. 2.5초 안에 못 오면 폴백이 더 낫다.
    const client = new Anthropic({ apiKey, maxRetries: 0 });
    const raw = await callAnthropic(client, system, user, controller.signal);
    clearTimeout(timer);

    let parsed: unknown;
    if (typeof raw === "string") {
      try {
        parsed = extractJson(raw);
      } catch (e) {
        return fallback(`JSON 파싱 실패: ${(e as Error).message}`);
      }
    } else {
      parsed = raw;
    }

    const result = validateTurnResponse(parsed, scene.clears ?? null);
    if (!result.ok) return fallback(`검증 실패: ${result.reason}`);

    const meta: TurnMeta = { engine: "api", fallbackReason: null, latencyMs: Date.now() - started };
    return NextResponse.json({ ...result.value, _meta: meta });
  } catch (e) {
    clearTimeout(timer);
    const err = e as Error;
    const reason =
      err.name === "AbortError" || err.name === "APIUserAbortError"
        ? `타임아웃 ${LLM_TIMEOUT_MS}ms`
        : `호출 실패: ${err.message}`;
    return fallback(reason);
  }
}
