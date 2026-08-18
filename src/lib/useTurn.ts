"use client";

import { useCallback, useRef, useState } from "react";
import { runTurn, type EngineChoice, type TurnOutcome } from "@/lib/engine/api-engine";
import type { TurnInput } from "@/lib/types";

/**
 * §4.2 — 에이전트는 3개지만 LLM 호출은 턴당 1회다.
 *
 * 여기는 "호출"만 맡는다. 음성을 언제 어떤 순서로 재생할지는 씬이 정한다.
 * 코치 문장을 아이가 따라 말할 때까지 기다려야 하는데, 그 대기가 호출 훅
 * 안에 있으면 씬이 진행을 막을 방법이 없다.
 */
export function useTurn(engineChoice: EngineChoice = "auto") {
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<TurnOutcome | null>(null);
  const runId = useRef(0);

  const reset = useCallback(() => {
    runId.current += 1;
    setPending(false);
    setOutcome(null);
  }, []);

  const submit = useCallback(
    async (input: TurnInput): Promise<TurnOutcome | null> => {
      const id = ++runId.current;
      setPending(true);
      const result = await runTurn(input, engineChoice);
      // 그 사이 씬이 바뀌었으면 버린다. 지난 턴의 대사가 새 씬에 끼어들지 않게.
      if (id !== runId.current) return null;
      setPending(false);
      setOutcome(result);
      return result;
    },
    [engineChoice],
  );

  return { pending, outcome, submit, reset };
}
