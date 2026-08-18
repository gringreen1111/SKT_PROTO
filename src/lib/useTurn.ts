"use client";

import { useCallback, useRef, useState } from "react";
import { runTurn, type EngineChoice, type TurnOutcome } from "@/lib/engine/api-engine";
import { speakAs, cancelSpeech } from "@/lib/speech/tts";
import type { TurnInput } from "@/lib/types";

/**
 * §4.2 오케스트레이션.
 * 에이전트는 3개지만 LLM 호출은 턴당 1회다.
 * 역할은 시간차 재생으로 분리하고, 호출은 하나로 묶는다.
 *
 *   아이가 말함
 *     → 즉시: 내레이터 배너 (LLM 미사용, 씬 고정 텍스트 — 호출부가 그린다)
 *     → 동시에: /api/turn 1회 → coach + npc 동시 수신
 *     → 순차 재생: 코치 음성 → (0.6초) → NPC 음성
 */

const COACH_TO_NPC_GAP_MS = 600;

export type TurnPhase = "idle" | "thinking" | "coach" | "npc" | "done";

export interface TurnState {
  phase: TurnPhase;
  outcome: TurnOutcome | null;
  /** 지금 말하고 있는 주체. 아바타 흔들림에 쓴다. */
  speakingAs: "coach" | "haneul" | "junseo" | "teacher" | null;
}

export function useTurn(engineChoice: EngineChoice = "auto") {
  const [state, setState] = useState<TurnState>({ phase: "idle", outcome: null, speakingAs: null });
  const runId = useRef(0);

  const reset = useCallback(() => {
    runId.current += 1;
    cancelSpeech();
    setState({ phase: "idle", outcome: null, speakingAs: null });
  }, []);

  /**
   * 한 턴을 돌린다.
   * @param speakCoach 코치 음성을 읽어줄지. 완전한 문장(L3)이면 건너뛴다.
   */
  const submit = useCallback(
    async (input: TurnInput, opts?: { speakCoach?: boolean }): Promise<TurnOutcome> => {
      const id = ++runId.current;
      cancelSpeech();
      setState({ phase: "thinking", outcome: null, speakingAs: null });

      const outcome = await runTurn(input, engineChoice);
      if (id !== runId.current) return outcome; // 중간에 다른 턴이 시작됐다

      setState({ phase: "coach", outcome, speakingAs: null });

      // 1) 코치 — 따라 읽을 문장을 가장 느리게 읽어준다.
      const speakCoach = opts?.speakCoach ?? true;
      const idx = outcome.coach.speakIndex;
      if (speakCoach && idx !== null && outcome.coach.suggestions[idx]) {
        setState((s) => ({ ...s, speakingAs: "coach" }));
        const line = outcome.coach.recast
          ? `${outcome.coach.recast} 이렇게 말해볼까? ${outcome.coach.suggestions[idx]}`
          : outcome.coach.suggestions[idx];
        await speakAs(line, "coach");
        if (id !== runId.current) return outcome;
        await sleep(COACH_TO_NPC_GAP_MS);
        if (id !== runId.current) return outcome;
      }

      // 2) NPC
      setState((s) => ({ ...s, phase: "npc", speakingAs: outcome.npc.speaker }));
      await speakAs(outcome.npc.line, outcome.npc.speaker);
      if (id !== runId.current) return outcome;

      setState({ phase: "done", outcome, speakingAs: null });
      return outcome;
    },
    [engineChoice],
  );

  return { ...state, submit, reset };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
