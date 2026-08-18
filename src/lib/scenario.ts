import type { Scenario, ScenarioScene } from "@/lib/types";
import korean from "../../scenarios/korean-presentation.json";

/**
 * §7 시나리오는 JSON으로 분리한다.
 * 새 상황을 추가할 때는 scenarios/ 에 파일 하나 더 만들고 여기 등록만 하면 된다.
 */
const REGISTRY: Record<string, Scenario> = {
  "korean-presentation": korean as Scenario,
};

export const DEFAULT_SCENARIO_ID = "korean-presentation";

export function getScenario(id: string): Scenario | null {
  return REGISTRY[id] ?? null;
}

export function listScenarioIds(): string[] {
  return Object.keys(REGISTRY);
}

export function getScene(scenario: Scenario, sceneId: string): ScenarioScene | null {
  return scenario.scenes.find((s) => s.id === sceneId) ?? null;
}

/**
 * §7 3계층 중 "세션 랜덤" — 실행마다 달라지는 변수를 뽑는다.
 * 하늘이가 소개할 책이 매 실행 달라지는 게 이 경로다.
 */
export function rollSessionVars(scenario: Scenario): Record<string, string> {
  const out: Record<string, string> = {};
  for (const scene of scenario.scenes) {
    for (const [key, choices] of Object.entries(scene.sessionVars ?? {})) {
      if (choices.length) out[key] = choices[Math.floor(Math.random() * choices.length)];
    }
  }
  return out;
}
