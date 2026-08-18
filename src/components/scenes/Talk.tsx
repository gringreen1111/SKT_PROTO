"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { GroupTable, type Said } from "@/components/room/GroupTable";
import { RoomBackdrop } from "@/components/room/RoomParts";
import { MicButton, MissionToast, NarratorBanner } from "@/components/ui/Bits";
import { interpolate } from "@/lib/agents/prompts";
import { BADGES } from "@/lib/data/catalog";
import type { EngineChoice, TurnOutcome } from "@/lib/engine/api-engine";
import { matchesTarget, matchLexicon, wordSlots } from "@/lib/engine/lexicon";
import { playSfx } from "@/lib/sfx";
import { listen, sttStatus, type SttSession } from "@/lib/speech/stt";
import { cancelSpeech, speakAs } from "@/lib/speech/tts";
import { useApp } from "@/lib/store";
import { useTurn } from "@/lib/useTurn";
import type { Scenario, ScenarioScene, SpeakerId, Turn } from "@/lib/types";

/**
 * §4 대화 씬. 모둠 책상에 둘러앉아 말풍선으로 이야기한다.
 *
 * 진행은 아래 상태 기계가 전부 쥔다. 타이머로 다음 씬으로 넘어가지 않는다.
 *
 *   npc-intro ─▶ listen ─▶ thinking ─┬─(완전한 문장)──────────────▶ reply ─▶ leaving
 *                  ▲                 └─(어눌함/단어만)─▶ coach ─▶ pick ─▶ echo ─┤
 *                  │                                                      │      │
 *                  └──────────────────────────────────────────────────────┘      │
 *                                    (따라 말하기 실패 시 같은 자리에서 다시)      │
 *
 * 아이가 문장을 고르고 그걸 말한 게 확인되기 전에는 다음 대화로 넘어가지 않는다.
 */

interface Props {
  scenario: Scenario;
  sceneIds: string[];
  engineChoice: EngineChoice;
  onDebug?: (o: TurnOutcome) => void;
  onDone: (lastChildLine: string) => void;
  title: string;
}

type Phase =
  | "npc-intro"
  | "listen"
  | "thinking"
  | "coach"
  | "pick"
  | "echo-intro"
  | "echo"
  | "reply"
  | "leaving";

/** 마이크가 열리는 단계. 그 외에는 잠근다. */
const MIC_OPEN: Phase[] = ["listen", "echo"];

/** 따라 말하기를 이 횟수까지 시도하면 그냥 통과시킨다 — 실패를 보여주지 않는다. */
const ECHO_GRACE = 3;

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

  const [phase, setPhase] = useState<Phase>("npc-intro");
  const [said, setSaid] = useState<Partial<Record<SpeakerId | "me", Said>>>({});
  const [latestNpc, setLatestNpc] = useState<SpeakerId | null>(null);
  const [history, setHistory] = useState<Turn[]>([]);
  const [interim, setInterim] = useState("");
  const [level, setLevel] = useState(0);
  const [listening, setListening] = useState(false);
  const [speakingAs, setSpeakingAs] = useState<SpeakerId | "me" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(sttStatus() === "supported" ? "voice" : "words");
  const [chosen, setChosen] = useState<string | null>(null);
  const [echoTries, setEchoTries] = useState(0);
  const [lastChildLine, setLastChildLine] = useState("");
  const [chips, setChips] = useState<string[]>([]);

  const session = useRef<SttSession | null>(null);
  const turn = useTurn(engineChoice);

  /** 이 씬에서 진행이 한 번만 일어나게 막는다. */
  const leftRef = useRef(false);
  /** 씬이 바뀌면 진행 중이던 비동기 흐름을 버린다. */
  const sceneRun = useRef(0);
  const phaseRef = useRef<Phase>("npc-intro");
  phaseRef.current = phase;

  const npcSpeaker: SpeakerId = scene?.npcTurn?.speaker ?? "haneul";

  /** 화자를 표시하면서 말한다. 끝날 때까지 기다린다. */
  const say = useCallback(async (text: string, who: SpeakerId | "coach", run: number) => {
    setSpeakingAs(who === "coach" ? null : who);
    await speakAs(text, who);
    if (run !== sceneRun.current) return false;
    setSpeakingAs(null);
    return true;
  }, []);

  const goNext = useCallback(
    (childLine: string) => {
      if (leftRef.current) return;
      leftRef.current = true;
      cancelSpeech();
      session.current?.abort();
      if (sceneIdx + 1 < scenes.length) setSceneIdx((i) => i + 1);
      else onDone(childLine || lastChildLine);
    },
    [sceneIdx, scenes.length, onDone, lastChildLine],
  );

  /* ── 씬이 열리면 NPC가 먼저 말한다 ── */
  useEffect(() => {
    if (!scene) return;
    const run = ++sceneRun.current;
    leftRef.current = false;

    // 지난 씬의 말풍선을 지운다. 안 그러면 대화가 섞여 보인다.
    cancelSpeech();
    session.current?.abort();
    turn.reset();
    setSaid({});
    setLatestNpc(null);
    setChosen(null);
    setEchoTries(0);
    setInterim("");
    setChips([]);
    setPhase("npc-intro");

    const opening = openingLine(scene, sessionVars, name);
    setSaid({ [npcSpeaker]: { speaker: npcSpeaker, text: opening.ko, i18n: opening.i18n[lang] ?? null } });
    setLatestNpc(npcSpeaker);
    setHistory((h) => [...h, { role: "npc", speaker: npcSpeaker, text: opening.ko }]);

    void (async () => {
      const ok = await say(opening.ko, npcSpeaker, run);
      if (!ok || run !== sceneRun.current) return;
      if (scene.childTurn) setPhase("listen");
      else {
        setPhase("leaving");
        goNext("");
      }
    })();

    return () => {
      sceneRun.current += 1;
      cancelSpeech();
      session.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene?.id]);

  /** NPC 반응을 재생하고 보상을 준 다음 씬을 넘긴다. */
  const playReplyAndLeave = useCallback(
    async (outcome: TurnOutcome, childLine: string, run: number) => {
      setPhase("reply");
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

      const ok = await say(outcome.npc.line, outcome.npc.speaker, run);
      if (!ok || run !== sceneRun.current) return;

      if (outcome.missionCleared && BADGES[outcome.missionCleared]) {
        addBadge(outcome.missionCleared);
        addXp(15);
        addCoins(5);
        playSfx("star");
        setToast(BADGES[outcome.missionCleared].label);
        await sleep(1500);
      } else {
        addXp(6);
        addCoins(3);
        await sleep(500);
      }
      if (run !== sceneRun.current) return;
      setPhase("leaving");
      goNext(childLine);
    },
    [say, addBadge, addXp, addCoins, goNext],
  );

  /* ── 아이가 처음 말했을 때 ── */
  const handleFirstUtterance = useCallback(
    async (transcript: string, confidence: number) => {
      if (!scene) return;
      const run = sceneRun.current;
      const text = transcript.trim();
      setInterim("");
      setLastChildLine(text);
      if (text) {
        setSaid((s) => ({ ...s, me: { speaker: "me", text } }));
        setHistory((h) => [...h, { role: "child", text }]);
      }

      setPhase("thinking");
      const outcome = await turn.submit({
        scenarioId: scenario.id,
        sceneId: scene.id,
        childName: name,
        homeLanguage: lang,
        transcript: text,
        sttConfidence: confidence,
        history: history.slice(-6),
        sessionVars,
      });
      if (!outcome || run !== sceneRun.current) return;
      onDebug?.(outcome);

      // 완전한 문장이면 코치를 건너뛰고 바로 친구가 반응한다(L3).
      if (outcome.coach.verdict === "complete") {
        await playReplyAndLeave(outcome, text, run);
        return;
      }

      // 어눌하거나 단어만 말했다 → 들린 말을 토대로 문장을 추천한다.
      setPhase("coach");
      const lead = outcome.coach.recast
        ? `${outcome.coach.recast} 이렇게 말해볼까?`
        : "천천히 해도 돼. 이렇게 말해볼까?";
      const ok = await say(lead, "coach", run);
      if (!ok || run !== sceneRun.current) return;
      setPhase("pick");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene?.id, history, name, lang, sessionVars, scenario.id, playReplyAndLeave, say],
  );

  /* ── 고른 문장을 따라 말했을 때 ── */
  const handleEcho = useCallback(
    async (transcript: string) => {
      const run = sceneRun.current;
      const target = chosen;
      const outcome = turn.outcome;
      if (!target || !outcome) return;

      const text = transcript.trim();
      setInterim("");
      if (text) setSaid((s) => ({ ...s, me: { speaker: "me", text } }));

      const tries = echoTries + 1;
      setEchoTries(tries);

      // 발음이 정확할 필요는 없다. 얼추 맞거나, 몇 번 해봤으면 통과시킨다.
      const good = matchesTarget(text, target) || tries >= ECHO_GRACE;

      if (!good) {
        const ok = await say("괜찮아, 잘 안 들렸나 봐. 한 번만 더 말해줄래?", "coach", run);
        if (!ok || run !== sceneRun.current) return;
        setPhase("echo");
        return;
      }

      // 성공 — 아이가 실제로 말한 문장이 아니라 "말하려던 문장"을 기록에 남긴다.
      playSfx("correct");
      setSaid((s) => ({ ...s, me: { speaker: "me", text: target } }));
      setLastChildLine(target);
      setHistory((h) => [...h, { role: "child", text: target }]);
      await playReplyAndLeave(outcome, target, run);
    },
    [chosen, turn.outcome, echoTries, say, playReplyAndLeave],
  );

  /** 추천 문장을 고른다 → 코치가 읽어준다 → 따라 말하기로 넘어간다. */
  const choose = useCallback(
    async (sentence: string) => {
      const run = sceneRun.current;
      playSfx("tap");
      setChosen(sentence);
      setEchoTries(0);
      setPhase("echo-intro");
      const ok = await say(sentence, "coach", run);
      if (!ok || run !== sceneRun.current) return;
      setPhase("echo");
    },
    [say],
  );

  const startListening = useCallback(() => {
    if (listening) {
      session.current?.stop();
      return;
    }
    if (!MIC_OPEN.includes(phaseRef.current)) return;
    playSfx("tap");
    cancelSpeech();
    setListening(true);
    setInterim("");

    const forEcho = phaseRef.current === "echo";

    session.current = listen({
      expect: forEcho ? chosen : null,
      onInterim: setInterim,
      onLevel: setLevel,
      onError: (kind) => {
        // 에러 화면을 띄우지 않는다. 마이크를 못 쓰면 단어 조합 모드로 넘어간다.
        if (kind === "denied" || kind === "unsupported") setMode("words");
      },
      onFinal: (text, confidence) => {
        setListening(false);
        setLevel(0);
        if (forEcho) void handleEcho(text);
        else void handleFirstUtterance(text, confidence);
      },
      onEnd: () => {
        setListening(false);
        setLevel(0);
      },
    });
  }, [listening, chosen, handleEcho, handleFirstUtterance]);

  if (!scene) return null;

  const coach = turn.outcome?.coach;
  const showSuggestions = (phase === "pick" || phase === "echo-intro" || phase === "echo") && Boolean(coach);
  const slots = wordSlots(matchLexicon(interim || lastChildLine)[0] ?? null);

  const micLabel = listening
    ? "다 말했으면 눌러줘"
    : phase === "thinking"
      ? "생각 중…"
      : phase === "echo"
        ? "눌러서 따라 말하기"
        : phase === "listen"
          ? "눌러서 말해보기"
          : phase === "pick"
            ? "문장을 골라줘"
            : "잠깐만…";

  const shown: Partial<Record<SpeakerId | "me", Said>> = interim
    ? { ...said, me: { speaker: "me", text: interim } }
    : said;

  const bubbleSpeaker: SpeakerId | "me" | null = listening || interim ? "me" : speakingAs;

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
          speakingAs={bubbleSpeaker}
          lang={lang}
          thinkingFor={phase === "thinking" ? npcSpeaker : null}
          latest={latestNpc}
        />
      </div>

      {/* 코치 — 들린 말을 토대로 만든 추천 문장 */}
      <AnimatePresence>
        {showSuggestions && coach ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="relative z-20 mx-3 mb-1 rounded-3xl bg-white/94 p-2.5"
          >
            <p className="mb-1.5 text-[12px] font-bold text-ink-soft">
              {phase === "pick"
                ? (coach.recast ?? "이 중에서 골라 읽어볼까?")
                : "이렇게 말해볼까? 마이크를 누르고 따라 말해줘"}
            </p>
            <div className="grid gap-1.5">
              {coach.suggestions.map((s, i) => {
                const picked = chosen === s;
                const dimmed = Boolean(chosen) && !picked;
                return (
                  <button
                    key={i}
                    disabled={phase !== "pick" && !picked}
                    onClick={() => {
                      if (phase === "pick") void choose(s);
                      else if (picked) void say(s, "coach", sceneRun.current);
                    }}
                    className={`tappable flex items-center gap-2 rounded-2xl px-3 py-2 text-left font-round text-[15.5px] text-ink ${
                      dimmed ? "opacity-40" : ""
                    }`}
                    style={{
                      background: picked ? "#FFE3C2" : "#FFF3DE",
                      boxShadow: picked ? "0 0 0 2.5px #FF8B5E" : undefined,
                    }}
                  >
                    <span>{picked ? "🔊" : "🗣️"}</span>
                    <span className="min-w-0 flex-1">{s}</span>
                    {picked ? <span className="shrink-0 text-[11px] font-bold text-ink-soft">다시 듣기</span> : null}
                  </button>
                );
              })}
            </div>
            {chosen && phase === "echo" ? (
              <button
                onClick={() => {
                  playSfx("tap");
                  setChosen(null);
                  setEchoTries(0);
                  setPhase("pick");
                }}
                className="mt-1.5 block w-full text-[12px] font-bold text-ink-soft/85"
              >
                다른 문장으로 바꿀래
              </button>
            ) : null}
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
              disabled={!MIC_OPEN.includes(phase)}
              onPress={startListening}
              label={micLabel}
            />
            {phase === "listen" || phase === "pick" ? (
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
            ) : null}
          </div>
        ) : (
          <WordBuilder
            slots={slots}
            chosen={chips}
            setChosen={setChips}
            disabled={phase !== "listen" && phase !== "pick" && phase !== "echo"}
            onSubmit={(sentence) => {
              setChips([]);
              // 단어로 만든 문장은 아이가 "말한" 것으로 본다. 따라 말하기를 요구하지 않는다.
              if (phaseRef.current === "echo" && chosen) void handleEcho(sentence);
              else void handleFirstUtterance(sentence, 1);
            }}
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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
    <div className="rounded-3xl bg-white/94 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-full bg-[#FFF3DE] px-2 py-1 text-[11.5px] font-bold text-ink-soft">
          {chosen.length >= slots.length ? "완성" : active?.label}
        </span>
        <p className="min-w-0 flex-1 truncate font-round text-[16px] text-ink">{sentence || "단어를 눌러보세요"}</p>
        {chosen.length ? (
          <button
            onClick={() => setChosen(chosen.slice(0, -1))}
            className="tappable shrink-0 rounded-full bg-ink/10 px-2.5 py-1 text-[12px] font-bold text-ink-soft"
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
