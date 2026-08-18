"use client";

import { useCallback, useEffect, useState } from "react";
import Classroom from "@/components/scenes/Classroom";
import Intro from "@/components/scenes/Intro";
import Reward from "@/components/scenes/Reward";
import Talk from "@/components/scenes/Talk";
import { SceneFade } from "@/components/ui/Bits";
import { DevPanel } from "@/components/ui/DevPanel";
import { Shell, Splash } from "@/components/ui/Shell";
import type { EngineChoice, TurnOutcome } from "@/lib/engine/api-engine";
import { DEFAULT_SCENARIO_ID, getScenario, rollSessionVars } from "@/lib/scenario";
import { setSfxEnabled } from "@/lib/sfx";
import { DEV_MODE } from "@/lib/speech/stt";
import { cancelSpeech } from "@/lib/speech/tts";
import { useApp, type SceneKey } from "@/lib/store";

const scenario = getScenario(DEFAULT_SCENARIO_ID)!;

/** groupwork 는 친구들 발표, sentence 는 아이 차례 + 마무리. */
const GROUPWORK_SCENES = ["teacher-intro", "haneul-share", "junseo-share"];
const SENTENCE_SCENES = ["child-turn", "wrapup"];

export default function Page() {
  const [booted, setBooted] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [engine, setEngine] = useState<EngineChoice>("auto");
  const [lastTurn, setLastTurn] = useState<TurnOutcome | null>(null);

  const scene = useApp((s) => s.scene);
  const soundOn = useApp((s) => s.soundOn);
  const toggleSound = useApp((s) => s.toggleSound);
  const setScene = useApp((s) => s.setScene);
  const nextScene = useApp((s) => s.nextScene);
  const setSessionVars = useApp((s) => s.setSessionVars);
  const setMyLine = useApp((s) => s.setMyLine);
  const markStarted = useApp((s) => s.markStarted);

  // zustand/persist 가 localStorage 를 읽기 전에는 그리지 않는다(하이드레이션 불일치 방지).
  useEffect(() => {
    setHydrated(true);
    // §7 세션 랜덤 — 실행마다 하늘이 책이 달라진다.
    setSessionVars(rollSessionVars(scenario));
  }, [setSessionVars]);

  useEffect(() => {
    setSfxEnabled(soundOn);
  }, [soundOn]);

  const skip = useCallback(() => {
    cancelSpeech();
    nextScene();
  }, [nextScene]);

  if (!hydrated) {
    return (
      <Shell>
        <div className="absolute inset-0 bg-cream" />
      </Shell>
    );
  }

  return (
    <Shell>
      {!booted ? <Splash onDone={() => setBooted(true)} /> : null}

      {booted ? (
        <>
          <SceneFade k={scene}>
            {scene === "intro" ? (
              <Intro
                onDone={() => {
                  markStarted();
                  setScene("classroom");
                }}
              />
            ) : null}

            {scene === "classroom" ? <Classroom onDone={() => setScene("groupwork")} /> : null}

            {scene === "groupwork" ? (
              <Talk
                key="groupwork"
                title="1교시 국어 · 조별 이야기"
                scenario={scenario}
                sceneIds={GROUPWORK_SCENES}
                engineChoice={engine}
                onDebug={setLastTurn}
                onDone={() => setScene("sentence")}
              />
            ) : null}

            {scene === "sentence" ? (
              <Talk
                key="sentence"
                title="1교시 국어 · 내 차례"
                scenario={scenario}
                sceneIds={SENTENCE_SCENES}
                engineChoice={engine}
                onDebug={setLastTurn}
                onDone={(line) => {
                  if (line) setMyLine(line);
                  setScene("reward");
                }}
              />
            ) : null}

            {scene === "reward" ? <Reward onRestart={() => setScene("intro")} /> : null}
          </SceneFade>

          {/* 소리 토글 — 어느 화면에서나 접근 가능 */}
          <button
            onClick={toggleSound}
            aria-label={soundOn ? "소리 끄기" : "소리 켜기"}
            className="pt-safe tappable absolute right-3 top-0 z-[65] mt-2 grid h-9 w-9 place-items-center rounded-full bg-white/70 text-[16px]"
          >
            {soundOn ? "🔊" : "🔇"}
          </button>

          {DEV_MODE ? <DevPanel engine={engine} setEngine={setEngine} last={lastTurn} onSkip={skip} /> : null}
        </>
      ) : null}
    </Shell>
  );
}

export type { SceneKey };
