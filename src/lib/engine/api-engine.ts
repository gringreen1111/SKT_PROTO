import type { DialogueEngine, TurnInput, TurnResponse } from "@/lib/types";
import { ruleEngine } from "./rule-engine";
import type { TurnMeta } from "@/app/api/turn/route";

/**
 * §6.2 엔진 선택.
 * ApiEngine 은 /api/turn 을 부른다. 2.5초를 넘기면 RuleEngine 결과를 쓴다.
 * 서버도 자체 타임아웃을 걸지만, 네트워크가 죽은 경우는 여기서만 잡힌다.
 */

const CLIENT_TIMEOUT_MS = 2500;

export type TurnOutcome = TurnResponse & { _meta: TurnMeta };

export class ApiEngine implements DialogueEngine {
  readonly name = "api" as const;

  async turn(input: TurnInput): Promise<TurnResponse> {
    const res = await this.turnWithMeta(input);
    return res;
  }

  async turnWithMeta(input: TurnInput): Promise<TurnOutcome> {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    try {
      const res = await fetch("/api/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as TurnOutcome;
      if (!json.coach || !json.npc) throw new Error("응답 형식 오류");
      return json;
    } catch (e) {
      clearTimeout(timer);
      const err = e as Error;
      const reason =
        err.name === "AbortError" ? `클라이언트 타임아웃 ${CLIENT_TIMEOUT_MS}ms` : `네트워크 실패: ${err.message}`;
      const value = await ruleEngine.turn(input);
      return { ...value, _meta: { engine: "rule", fallbackReason: reason, latencyMs: Date.now() - started } };
    }
  }
}

export const apiEngine = new ApiEngine();

/** ?dev=1 패널에서 엔진을 강제로 고정할 수 있다(§9-7). */
export type EngineChoice = "auto" | "rule" | "api";

export async function runTurn(input: TurnInput, choice: EngineChoice = "auto"): Promise<TurnOutcome> {
  if (choice === "rule") {
    const started = Date.now();
    const value = await ruleEngine.turn(input);
    return { ...value, _meta: { engine: "rule", fallbackReason: "dev: rule 고정", latencyMs: Date.now() - started } };
  }
  return apiEngine.turnWithMeta(input);
}
