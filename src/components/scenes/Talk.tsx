"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { GroupTable, type Said } from "@/components/room/GroupTable";
import { RoomBackdrop } from "@/components/room/RoomParts";
import { MicButton, MissionToast, NarratorBanner } from "@/components/ui/Bits";
import { interpolate } from "@/lib/agents/prompts";
import { BADGES } from "@/lib/data/catalog";
import type { EngineChoice, TurnOutcome } from "@/lib/engine/api-engine";
import { matchLexicon, wordSlots } from "@/lib/engine/lexicon";
import { check } from "@/lib/engine/rule-engine";
import { playSfx } from "@/lib/sfx";
import { listen, sttStatus, type SttSession } from "@/lib/speech/stt";
import { cancelSpeech, speakAs } from "@/lib/speech/tts";
import { useApp } from "@/lib/store";
import { useTurn } from "@/lib/useTurn";
import type { Scenario, ScenarioScene, SpeakerId, Turn } from "@/lib/types";

/**
 * §4 대화 씬. 모둠 책상에 둘러앉아 말풍선으로 이야기한다.
 * childTurn: false 인 씬은 NPC 대사만 재생하고 넘어간다.
 * childTurn: true 인 씬에서 아이가 말하면 /api/turn 1회로 coach + npc 를 받는다.
 */

interface Props {
  scenario: Scenario;
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

  const [said, setSaid] = useState<Partial<Record<SpeakerId | "me", Said>>>({});
  const [history, setHistory] = useState<Turn[]>([]);
  const [interim, setInterim] = useState("");
  const [level, setLevel] = useState(0);
  const [listening, setListening] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(sttStatus() === "supported" ? "voice" : "words");
  const [chosen, setChosen] = useState<string[]>([]);
  const [introDone, setIntroDone] = useState(false);
  const [lastChildLine, setLastChildLine] = useState("");
  /** 방금 말한 NPC. 말풍선을 이 사람 것만 띄운다. */
  const [latestNpc, setLatestNpc] = useState<SpeakerId | null>(null);

  const session = useRef<SttSession | null>(null);
  const turn = useTurn(engineChoice);

  const npcSpeaker: SpeakerId = scene?.npcTurn?.speaker ?? "haneul";

  const advance = useCallback(
    (childLine: string) => {
      cancelSpeech();
      if (sceneIdx + 1 < scenes.length) setSceneIdx((i) => i + 1);
      else onDone(childLine || lastChildLine);
    },
    [sceneIdx, scenes.length, onDone, lastChildLine],
  );

  /* ── 씬이 열리면 NPC가 먼저 말한다 ── */
  useEffect(() => {
    if (!scene) return;
    let alive = true;
    setIntroDone(false);
    setInterim("");
    setChosen([]);
    turn.reset();

    const opening = openingLine(scene, sessionVars, name);
    setSaid((s) => ({ ...s, [npcSpeaker]: { speaker: npcSpeaker, text: opening.ko, i18n: opening.i18n[lang] ?? null } }));
    setLatestNpc(npcSpeaker);
    setHistory((h) => [...h, { role: "npc", speaker: npcSpeaker, text: opening.ko }]);

    void speakAs(opening.ko, npcSpeaker).then(() => {
      if (!alive) return;
      setIntroDone(true);
      if (!scene.childTurn) setTimeout(() => alive && advance(""), 900);
    });

    return () => {
      alive = false;
      cancelSpeech();
      session.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene?.id]);

  /* ── 아이 발화 처리 ── */
  const handleChildSpeech = useCallback(
    async (transcript: string, confidence: number) => {
      if (!scene) return;
      const text = transcript.trim();
      setInterim("");
      setLastChildLine(text);

      if (text) {
        setSaid((s) => ({ ...s, me: { speaker: "me", text } }));
        setHistory((h) => [...h, { role: "child", text }]);
      }

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
      setSaid((s) => ({
        ...s,
        [outcome.npc.speaker]: {
          speaker: outcome.npc.speaker,
          text: outcome.npc.line,
          i18n: outcome.npc.lineI18n,
        },
      }));
      setLatestNpc(outcome.npc.speaker);
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

      setTimeout(() => advance(text), outcome.missionCleared ? 1700 : 1000);
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
        void handleChildSpeech(text, confidence);
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

  // 아이가 말하는 중에는 자기 말풍선을 실시간으로 보여준다.
  const shown: Partial<Record<SpeakerId | "me", Said>> = interim
    ? { ...said, me: { speaker: "me", text: interim } }
    : said;

  const speakingAs: SpeakerId | "me" | null = listening || interim ? "me" : turn.speakingAs === "coach" ? null : turn.speakingAs;

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <RoomBackdrop />

      <header className="pt-safe relative px-4 pt-2">
        <p className="text-[11.5px] font-bold text-ink-soft">{title}</p>
      </header>

      {/* 내레이터 — 즉시, LLM 미사용. 오른쪽은 소리 토글 자리라 비워 둔다. */}
      <div className="pointer-events-none relative z-30 mt-1 pr-11">
        <AnimatePresence mode="wait">
          <NarratorBanner
            key={`${scene.id}-${turn.outcome?.narratorHint ?? ""}`}
            text={turn.outcome?.narratorHint ?? scene.narrator}
            translated={scene.narratorI18n?.[lang] ?? null}
            lang={lang}
          />
        </AnimatePresence>
      </div>

      {/* 모둠 책상 */}
      <div className="relative min-h-0 flex-1">
        <GroupTable
          said={shown}
          speakingAs={speakingAs}
          lang={lang}
          thinkingFor={turn.phase === "thinking" ? npcSpeaker : null}
          latest={latestNpc}
        />
      </div>

      {/* 코치 — 추천 문장 */}
      <AnimatePresence>
        {coach && coach.suggestions.length && turn.phase !== "thinking" && coach.verdict !== "complete" ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="relative z-20 mx-3 mb-1 rounded-3xl bg-white/92 p-2.5"
          >
            <p className="mb-1.5 text-[12px] font-bold text-ink-soft">{coach.recast ?? "이렇게 말해볼까?"}</p>
            <div className="grid gap-1.5">
              {coach.suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => {
                    playSfx("tap");
                    void speakAs(s, "coach");
                  }}
                  className="tappable rounded-2xl bg-[#FFF3DE] px-3 py-2 text-left font-round text-[15.5px] text-ink"
                >
                  🗣️ {s}
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* 입력 */}
      <footer className="pb-safe relative z-20 px-4 pb-3 pt-1">
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
              className="mt-0.5 text-[12px] font-bold text-ink-soft/85"
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

      <div className="pointer-events-none absolute inset-x-0 top-[38%] z-40 grid place-items-center">
        <AnimatePresence>{toast ? <MissionToast label={toast} onDone={() => setToast(null)} /> : null}</AnimatePresence>
      </div>
    </div>
  );
}

/**
 * 씬의 첫 대사. LLM 없이도 씬이 열려야 한다.
 * 이 대사들은 고정이라 §7대로 사전 번역해 둔다.
 */
function openingLine(
  scene: ScenarioScene,
  vars: Record<string, string>,
  childName: string,
): { ko: string; i18n: Partial<Record<string, string>> } {
  const book = vars.haneulBook ?? "구름빵";
  const jbook = vars.junseoBook ?? "강아지똥";
  const who = childName || "친구";

  switch (scene.id) {
    case "teacher-intro":
      return {
        ko: "자, 오늘은 읽은 책을 소개해 볼 거예요. 한 명씩 이야기해요 📖",
        i18n: {
          vi: "Nào, hôm nay chúng ta sẽ giới thiệu cuốn sách đã đọc. Lần lượt từng bạn nhé 📖",
          zh: "好，今天我们来介绍读过的书。一个一个轮流说说看 📖",
          ru: "Итак, сегодня расскажем о книге, которую читали. Давайте по очереди 📖",
          tl: "Ngayon, ipakilala natin ang aklat na binasa. Isa-isa tayo 📖",
        },
      };
    case "haneul-share":
      return {
        ko: `나부터 할래! 나는 『${book}』 읽었어. 진짜 재미있었어 ✨`,
        i18n: {
          vi: `Mình nói trước nhé! Mình đọc “${book}”. Thích lắm ✨`,
          zh: `我先来！我读了《${book}》。真的很有趣 ✨`,
          ru: `Я первая! Я читала «${book}». Было очень интересно ✨`,
          tl: `Ako muna! Binasa ko ang “${book}”. Ang saya ✨`,
        },
      };
    case "junseo-share":
      return {
        ko: `…나는 『${jbook}』 읽었어. 조금 슬펐는데 마지막이 좋았어.`,
        i18n: {
          vi: `…Mình đọc “${jbook}”. Hơi buồn nhưng đoạn cuối hay lắm.`,
          zh: `…我读了《${jbook}》。有点难过，不过结局很好。`,
          ru: `…Я читал «${jbook}». Немного грустно, но конец хороший.`,
          tl: `…Binasa ko ang “${jbook}”. Medyo malungkot pero maganda ang dulo.`,
        },
      };
    case "child-turn":
      return {
        ko: `${who}, 이제 네 차례야! 두근두근 😊`,
        i18n: {
          vi: `${who} ơi, tới lượt cậu rồi! Hồi hộp quá 😊`,
          zh: `${who}，现在轮到你了！好期待 😊`,
          ru: `${who}, теперь твоя очередь! Волнительно 😊`,
          tl: `${who}, ikaw naman! Kinakabahan ako 😊`,
        },
      };
    case "wrapup":
      return {
        ko: "오늘 친구들 앞에서 이야기했어요. 정말 잘했어요 👏",
        i18n: {
          vi: "Hôm nay cậu đã nói trước các bạn. Giỏi lắm 👏",
          zh: "今天你在朋友们面前说话了。做得非常好 👏",
          ru: "Сегодня ты говорил перед друзьями. Молодец 👏",
          tl: "Nagsalita ka sa harap ng mga kaibigan. Ang galing 👏",
        },
      };
    default:
      return { ko: scene.npcTurn ? interpolate(scene.npcTurn.intent, vars) : "…", i18n: {} };
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
    <div className="rounded-3xl bg-white/92 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-full bg-[#FFF3DE] px-2 py-1 text-[11.5px] font-bold text-ink-soft">
          {chosen.length >= slots.length ? "완성" : active?.label}
        </span>
        <p className="min-w-0 flex-1 truncate font-round text-[16px] text-ink">{sentence || "단어를 눌러보세요"}</p>
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
              className="tappable rounded-full bg-[#FFF3DE] px-3 py-2 font-round text-[15.5px] text-ink"
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
        <button onClick={onBackToVoice} className="mt-2 block w-full text-[12px] font-bold text-ink-soft/85">
          🎤 목소리로 말할래
        </button>
      ) : null}
    </div>
  );
}
