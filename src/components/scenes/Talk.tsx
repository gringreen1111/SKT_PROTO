"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { MyAvatar, NpcAvatar } from "@/components/ui/Avatar";
import { Bubble, MicButton, MissionToast, NarratorBanner, Thinking } from "@/components/ui/Bits";
import { BADGES, CHARACTERS } from "@/lib/data/catalog";
import type { EngineChoice, TurnOutcome } from "@/lib/engine/api-engine";
import { check } from "@/lib/engine/rule-engine";
import { matchLexicon, wordSlots } from "@/lib/engine/lexicon";
import { interpolate } from "@/lib/agents/prompts";
import { playSfx } from "@/lib/sfx";
import { listen, sttStatus, STT_CONFIDENCE_FLOOR, type SttSession } from "@/lib/speech/stt";
import { cancelSpeech, speakAs } from "@/lib/speech/tts";
import { useApp } from "@/lib/store";
import { useTurn } from "@/lib/useTurn";
import type { Scenario, ScenarioScene, SpeakerId, Turn } from "@/lib/types";

/**
 * §4 대화 씬. 시나리오의 씬 배열을 순서대로 돈다.
 * childTurn: false 인 씬은 NPC 대사만 재생하고 넘어간다.
 * childTurn: true 인 씬에서 아이가 말하면 /api/turn 1회로 coach + npc 를 받는다.
 */

interface Props {
  scenario: Scenario;
  /** 이 컴포넌트가 담당할 씬 id 목록. groupwork / sentence 로 나눠 쓴다. */
  sceneIds: string[];
  engineChoice: EngineChoice;
  onDebug?: (o: TurnOutcome) => void;
  onDone: (lastChildLine: string) => void;
  title: string;
}

type Mode = "voice" | "words";

export default function Talk({ scenario, sceneIds, engineChoice, onDebug, onDone, title }: Props) {
  const name = useApp((s) => s.name);
  const lang = useApp((s) => s.lang);
  const sessionVars = useApp((s) => s.sessionVars);
  const addXp = useApp((s) => s.addXp);
  const addCoins = useApp((s) => s.addCoins);
  const addBadge = useApp((s) => s.addBadge);
  const useHint = useApp((s) => s.useHint);

  const scenes = sceneIds
    .map((id) => scenario.scenes.find((s) => s.id === id))
    .filter((s): s is ScenarioScene => Boolean(s));

  const [sceneIdx, setSceneIdx] = useState(0);
  const scene = scenes[sceneIdx];

  const [history, setHistory] = useState<Turn[]>([]);
  const [interim, setInterim] = useState("");
  const [level, setLevel] = useState(0);
  const [listening, setListening] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(sttStatus() === "supported" ? "voice" : "words");
  const [chosen, setChosen] = useState<string[]>([]);
  const [introDone, setIntroDone] = useState(false);
  const [lastChildLine, setLastChildLine] = useState("");

  const session = useRef<SttSession | null>(null);
  const turn = useTurn(engineChoice);
  const scroller = useRef<HTMLDivElement>(null);

  const npcSpeaker: SpeakerId = scene?.npcTurn?.speaker ?? "haneul";

  /* ── 씬이 열리면 NPC가 먼저 말한다 ── */
  useEffect(() => {
    if (!scene) return;
    let alive = true;
    setIntroDone(false);
    setInterim("");
    setChosen([]);
    turn.reset();

    const opening = openingLine(scene, sessionVars, name);
    setHistory((h) => [...h, { role: "npc", speaker: npcSpeaker, text: opening }]);

    void speakAs(opening, npcSpeaker).then(() => {
      if (!alive) return;
      setIntroDone(true);
      // 아이 차례가 아닌 씬은 바로 다음으로 넘어간다.
      if (!scene.childTurn) setTimeout(() => alive && advance(""), 700);
    });

    return () => {
      alive = false;
      cancelSpeech();
      session.current?.abort();
    };
    // scene.id 가 바뀔 때만 다시 돈다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene?.id]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [history, turn.phase]);

  const advance = useCallback(
    (childLine: string) => {
      cancelSpeech();
      if (sceneIdx + 1 < scenes.length) {
        setSceneIdx((i) => i + 1);
      } else {
        onDone(childLine || lastChildLine);
      }
    },
    [sceneIdx, scenes.length, onDone, lastChildLine],
  );

  /* ── 아이 발화 처리 ── */
  const handleChildSpeech = useCallback(
    async (transcript: string, confidence: number) => {
      if (!scene) return;
      const text = transcript.trim();
      setInterim("");
      setLastChildLine(text);

      if (text) setHistory((h) => [...h, { role: "child", text }]);

      const local = check(text);
      const outcome = await turn.submit(
        {
          scenarioId: scenario.id,
          sceneId: scene.id,
          childName: name,
          homeLanguage: lang,
          transcript: text,
          sttConfidence: confidence,
          history: history.slice(-6),
          sessionVars,
        },
        // 이미 완전한 문장이면 코치 음성을 건너뛰고 NPC 반응으로 바로 넘긴다(L3).
        { speakCoach: local.state !== "SUCCESS" },
      );

      onDebug?.(outcome);
      setHistory((h) => [...h, { role: "npc", speaker: outcome.npc.speaker, text: outcome.npc.line }]);

      if (outcome.missionCleared && BADGES[outcome.missionCleared]) {
        addBadge(outcome.missionCleared);
        addXp(15);
        addCoins(5);
        playSfx("star");
        setToast(BADGES[outcome.missionCleared].label);
      } else {
        addXp(6);
        addCoins(3);
      }

      // 다음 씬으로. 미션 토스트가 뜰 시간을 준다.
      setTimeout(() => advance(text), outcome.missionCleared ? 1500 : 800);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene?.id, history, name, lang, sessionVars, scenario.id],
  );

  const startListening = useCallback(() => {
    if (listening) {
      session.current?.stop();
      return;
    }
    playSfx("tap");
    cancelSpeech();
    setListening(true);
    setInterim("");

    session.current = listen({
      onInterim: setInterim,
      onLevel: setLevel,
      onError: (kind) => {
        // 에러 화면을 띄우지 않는다. 마이크를 못 쓰면 단어 조합 모드로 넘어간다.
        if (kind === "denied" || kind === "unsupported") setMode("words");
      },
      onFinal: (text, confidence) => {
        setListening(false);
        setLevel(0);
        // confidence 가 낮으면 내용을 추측하지 않는다(§8.2).
        void handleChildSpeech(text, confidence < STT_CONFIDENCE_FLOOR ? confidence : confidence);
      },
      onEnd: () => {
        setListening(false);
        setLevel(0);
      },
    });
  }, [listening, handleChildSpeech]);

  if (!scene) return null;

  const busy = turn.phase === "thinking" || turn.phase === "coach" || turn.phase === "npc";
  const canSpeak = introDone && !busy && scene.childTurn;
  const coach = turn.outcome?.coach;
  const slots = wordSlots(matchLexicon(interim || lastChildLine)[0] ?? null);

  return (
    <div className="relative flex h-full flex-col bg-gradient-to-b from-[#FDF1DC] to-[#F6E2C7]">
      <header className="pt-safe px-4 pt-2">
        <p className="text-[12px] font-bold text-ink-soft">{title}</p>
      </header>

      {/* 내레이터 — 즉시, LLM 미사용 */}
      <div className="pointer-events-none absolute inset-x-0 top-[46px] z-30">
        <AnimatePresence mode="wait">
          <NarratorBanner
            key={`${scene.id}-${turn.outcome?.narratorHint ?? ""}`}
            text={turn.outcome?.narratorHint ?? scene.narrator}
            translated={scene.narratorI18n?.[lang] ?? null}
            lang={lang}
          />
        </AnimatePresence>
      </div>

      {/* 대화 */}
      <div ref={scroller} className="flex-1 overflow-y-auto no-scrollbar px-3 pb-2 pt-[62px]">
        <div className="flex flex-col gap-2.5">
          {history.map((t, i) => {
            if (t.role === "child") {
              return (
                <div key={i} className="flex items-end justify-end gap-2">
                  <Bubble text={t.text} side="right" tint="#FFE3C2" />
                  <MyAvatar size={38} />
                </div>
              );
            }
            const c = CHARACTERS[t.speaker ?? "haneul"];
            return (
              <div key={i} className="flex items-end gap-2">
                <NpcAvatar
                  id={c.id}
                  size={38}
                  tint={c.tint}
                  speaking={turn.speakingAs === c.id && i === history.length - 1}
                />
                <Bubble text={t.text} tint="#FFFFFF" />
              </div>
            );
          })}

          {turn.phase === "thinking" ? (
            <div className="flex items-end gap-2">
              <NpcAvatar id={npcSpeaker} size={38} tint={CHARACTERS[npcSpeaker].tint} />
              <Thinking />
            </div>
          ) : null}

          {interim ? (
            <div className="flex items-end justify-end gap-2">
              <Bubble text={interim} side="right" tint="#FFF0DC" />
              <MyAvatar size={38} speaking />
            </div>
          ) : null}
        </div>
      </div>

      {/* 코치 — 추천 문장 */}
      <AnimatePresence>
        {coach && coach.suggestions.length && turn.phase !== "thinking" && coach.verdict !== "complete" ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="mx-3 mb-1 rounded-3xl bg-white/88 p-3"
          >
            <p className="mb-1.5 text-[12.5px] font-bold text-ink-soft">
              {coach.recast ?? "이렇게 말해볼까?"}
            </p>
            <div className="grid gap-1.5">
              {coach.suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => {
                    playSfx("tap");
                    void speakAs(s, "coach");
                  }}
                  className="tappable rounded-2xl bg-[#FFF3DE] px-3 py-2 text-left font-round text-[16px] text-ink"
                >
                  🗣️ {s}
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* 입력 */}
      <footer className="pb-safe px-4 pb-3 pt-1">
        {mode === "voice" ? (
          <div className="grid place-items-center gap-1">
            <MicButton
              listening={listening}
              level={level}
              disabled={!canSpeak}
              onPress={startListening}
              label={
                busy ? "듣고 있어…" : listening ? "다 말했으면 눌러줘" : scene.childTurn ? "눌러서 말해보기" : "잠깐만…"
              }
            />
            <button
              onClick={() => {
                playSfx("tap");
                useHint();
                setMode("words");
              }}
              className="mt-1 text-[12.5px] font-bold text-ink-soft/85"
            >
              말이 잘 안 나와요 · 단어로 만들래 🧩
            </button>
          </div>
        ) : (
          <WordBuilder
            slots={slots}
            chosen={chosen}
            setChosen={setChosen}
            disabled={!canSpeak}
            onSubmit={(sentence) => void handleChildSpeech(sentence, 1)}
            onBackToVoice={sttStatus() === "supported" ? () => setMode("voice") : undefined}
          />
        )}
      </footer>

      <div className="pointer-events-none absolute inset-x-0 bottom-40 z-40 grid place-items-center">
        <AnimatePresence>{toast ? <MissionToast label={toast} onDone={() => setToast(null)} /> : null}</AnimatePresence>
      </div>
    </div>
  );
}

/** 씬 정의의 intent 로 첫 대사를 만든다. LLM 없이도 씬이 열려야 한다. */
function openingLine(scene: ScenarioScene, vars: Record<string, string>, childName: string): string {
  const intent = scene.npcTurn ? interpolate(scene.npcTurn.intent, vars) : "";
  const book = vars.haneulBook ?? "구름빵";
  const jbook = vars.junseoBook ?? "강아지똥";

  switch (scene.id) {
    case "teacher-intro":
      return "자, 오늘은 읽은 책을 친구들에게 소개해 볼 거예요. 한 명씩 이야기해 볼까요? 📖";
    case "haneul-share":
      return `나부터 할래! 나는 『${book}』 읽었어. 진짜 재미있었어 ✨`;
    case "junseo-share":
      return `…나는 『${jbook}』 읽었어. 조금 슬펐는데… 마지막이 좋았어.`;
    case "child-turn":
      return `${childName || "친구"}, 이제 네 차례야! 두근두근 😊`;
    case "wrapup":
      return "오늘 friends 앞에서 이야기했어요. 정말 잘했어요 👏".replace("friends", "친구들");
    default:
      return intent || "…";
  }
}

/** §3 단어 조합 모드 — 누가 / 무엇을 / 어떻게. 음성 없이도 끝까지 갈 수 있다. */
function WordBuilder({
  slots,
  chosen,
  setChosen,
  disabled,
  onSubmit,
  onBackToVoice,
}: {
  slots: { label: string; chips: string[] }[];
  chosen: string[];
  setChosen: (v: string[]) => void;
  disabled?: boolean;
  onSubmit: (sentence: string) => void;
  onBackToVoice?: () => void;
}) {
  const sentence = chosen.join(" ");
  const slotIdx = Math.min(chosen.length, slots.length - 1);
  const active = slots[slotIdx];

  return (
    <div className="rounded-3xl bg-white/88 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-full bg-[#FFF3DE] px-2 py-1 text-[11.5px] font-bold text-ink-soft">
          {active?.label ?? "완성"}
        </span>
        <p className="min-w-0 flex-1 truncate font-round text-[17px] text-ink">{sentence || "단어를 눌러보세요"}</p>
        {chosen.length ? (
          <button
            onClick={() => setChosen(chosen.slice(0, -1))}
            className="tappable shrink-0 rounded-full bg-ink/8 px-2.5 py-1 text-[12px] font-bold text-ink-soft"
          >
            ← 지우기
          </button>
        ) : null}
      </div>

      {chosen.length < slots.length ? (
        <div className="flex flex-wrap gap-1.5">
          {active?.chips.map((c) => (
            <button
              key={c}
              onClick={() => {
                playSfx("tap");
                setChosen([...chosen, c]);
              }}
              className="tappable rounded-full bg-[#FFF3DE] px-3 py-2 font-round text-[16px] text-ink"
            >
              {c}
            </button>
          ))}
        </div>
      ) : (
        <button className="btn-primary w-full" disabled={disabled} onClick={() => onSubmit(sentence)}>
          이렇게 말할래! ✅
        </button>
      )}

      {onBackToVoice ? (
        <button onClick={onBackToVoice} className="mt-2 block w-full text-[12.5px] font-bold text-ink-soft/85">
          🎤 목소리로 말할래
        </button>
      ) : null}
    </div>
  );
}
