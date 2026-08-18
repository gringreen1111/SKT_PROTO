"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { NpcAvatar } from "@/components/ui/Avatar";
import { MissionToast, NarratorBanner } from "@/components/ui/Bits";
import {
  CHARACTERS,
  CLOCK_TIME,
  CORRECT_BOOK,
  LOCKER_BOOKS,
  SUBJECTS,
  SUBJECT_HINT,
  TIMETABLE,
  TODAY_LABEL,
} from "@/lib/data/catalog";
import { playSfx } from "@/lib/sfx";
import { speakAs } from "@/lib/speech/tts";
import { useApp } from "@/lib/store";

/**
 * §3 그대로 유지 — 벽시계 → 시간표 → 사물함에서 국어책 찾기.
 * 여기는 LLM을 쓰지 않는다. 고정 안내와 하늘이의 짧은 대사로 진행한다.
 */

type Step = "clock" | "timetable" | "locker" | "done";

const NARRATION: Record<Step, { ko: string; hint: string }> = {
  clock: { ko: "지금 몇 시일까? 벽에 걸린 시계를 봐.", hint: "시계를 눌러보세요" },
  timetable: { ko: "8시 40분이야. 곧 1교시가 시작돼. 시간표에 뭐라고 써 있어?", hint: "1교시를 찾아보세요" },
  locker: { ko: "1교시는 국어야. 사물함에서 국어책을 찾아보자!", hint: "국어책을 찾아보세요" },
  done: { ko: "잘했어! 준비 완료 🎉", hint: "" },
};

export default function Classroom({ onDone }: { onDone: () => void }) {
  const lang = useApp((s) => s.lang);
  const addXp = useApp((s) => s.addXp);
  const addCoins = useApp((s) => s.addCoins);
  const addBadge = useApp((s) => s.addBadge);
  const useHint = useApp((s) => s.useHint);
  const hintsUsed = useApp((s) => s.hintsUsed);

  const [step, setStep] = useState<Step>("clock");
  const [toast, setToast] = useState<string | null>(null);
  const [wrongPick, setWrongPick] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);

  // 씬이 바뀌면 하늘이가 상황을 읽어준다.
  useEffect(() => {
    if (step === "done") return;
    let alive = true;
    setSpeaking(true);
    void speakAs(NARRATION[step].ko, "haneul").then(() => {
      if (alive) setSpeaking(false);
    });
    return () => {
      alive = false;
    };
  }, [step]);

  const advance = (next: Step) => {
    playSfx("correct");
    setStep(next);
  };

  const finish = () => {
    // 힌트 없이 왔으면 "스스로 해냈어요" 도 같이 준다.
    addBadge("timetable");
    if (hintsUsed === 0) addBadge("selfsolve");
    addXp(10);
    addCoins(8);
    playSfx("star");
    setToast("시간표 마스터");
  };

  return (
    <div className="relative flex h-full flex-col bg-gradient-to-b from-[#FCEFD8] to-[#F5E0C4]">
      {/* 칠판 */}
      <div className="pt-safe px-3 pt-2">
        <div className="rounded-2xl px-3 py-2" style={{ background: "#3E6B52", boxShadow: "0 6px 0 0 #2E5140" }}>
          <p className="font-round text-[15px] text-[#EAF6EE]">{TODAY_LABEL} · 1학년 3반</p>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-[64px] z-30">
        <AnimatePresence mode="wait">
          {step !== "done" ? (
            <NarratorBanner key={step} text={NARRATION[step].ko} translated={null} lang={lang} />
          ) : null}
        </AnimatePresence>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-3 pt-[54px]">
        {/* ── 벽시계 ── */}
        {step === "clock" ? (
          <div className="grid place-items-center pt-4">
            <button
              onClick={() => advance("timetable")}
              className="tappable glow-hint grid place-items-center"
              aria-label={`벽시계 ${CLOCK_TIME.h}시 ${CLOCK_TIME.m}분`}
            >
              <Clock h={CLOCK_TIME.h} m={CLOCK_TIME.m} />
            </button>
            <p className="mt-4 font-round text-[18px] text-ink">지금 몇 시지? 🕐</p>
          </div>
        ) : null}

        {/* ── 시간표 ── */}
        {step === "timetable" ? (
          <div className="pt-2">
            <div className="card mx-auto max-w-[300px] p-3" style={{ transform: "rotate(-1.4deg)" }}>
              <p className="mb-2 text-center font-round text-[18px] text-ink">시간표</p>
              <div className="grid gap-1.5">
                {TIMETABLE.map((row) => {
                  const s = SUBJECTS[row.subject];
                  const first = row.no === 1;
                  return (
                    <button
                      key={row.no}
                      onClick={() => {
                        if (first) return advance("locker");
                        playSfx("tap");
                        void speakAs("음… 지금은 그 시간이 아닌 것 같아.", "haneul");
                      }}
                      className={`tappable flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left ${first ? "glow-hint" : ""}`}
                      style={{ background: first ? "#FFF3DE" : "rgba(255,255,255,.62)" }}
                    >
                      <span className="w-[42px] shrink-0 text-[12.5px] font-bold text-ink-soft">{row.label}</span>
                      <span
                        className="grid h-8 w-8 place-items-center rounded-lg text-[17px]"
                        style={{ background: s.color, boxShadow: `0 3px 0 0 ${s.colorDark}` }}
                      >
                        {s.iconChar}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-round text-[17px] text-ink">{row.subject}</span>
                        <span className="block text-[11.5px] text-ink-soft">
                          {SUBJECT_HINT[row.subject]?.[lang] ?? SUBJECT_HINT[row.subject]?.ko}
                        </span>
                      </span>
                      <span className="shrink-0 text-[12px] font-bold text-ink-soft">{row.time}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {/* ── 사물함 ── */}
        {step === "locker" ? (
          <div className="pt-2">
            <p className="mb-2 text-center font-round text-[17px] text-ink">사물함을 열었어. 어떤 책이 필요할까?</p>
            <div className="grid grid-cols-3 gap-2.5">
              {LOCKER_BOOKS.map((b) => {
                const s = SUBJECTS[b];
                const right = b === CORRECT_BOOK;
                const nudged = wrongPick === b;
                return (
                  <motion.button
                    key={b}
                    animate={nudged ? { rotate: [0, -3, 3, 0] } : {}}
                    transition={{ duration: 0.35 }}
                    onClick={() => {
                      if (right) {
                        setStep("done");
                        finish();
                        return;
                      }
                      // 틀렸다는 표시를 하지 않는다. 책이 살짝 흔들리고 하늘이가 넘겨준다.
                      playSfx("tap");
                      setWrongPick(b);
                      void speakAs("음… 지금은 그 시간이 아닌 것 같아.", "haneul");
                      setTimeout(() => setWrongPick(null), 400);
                    }}
                    className={`tappable grid place-items-center gap-1 rounded-2xl p-3 ${right ? "glow-hint" : ""}`}
                    style={{ background: "rgba(255,255,255,.72)", boxShadow: `0 4px 0 0 ${s.colorDark}55` }}
                    aria-label={`${b} 교과서`}
                  >
                    <span
                      className="grid h-11 w-11 place-items-center rounded-xl text-[22px]"
                      style={{ background: s.color, boxShadow: `0 3px 0 0 ${s.colorDark}` }}
                    >
                      {s.iconChar}
                    </span>
                    <span className="font-round text-[15px] text-ink">{b}</span>
                  </motion.button>
                );
              })}
            </div>
            <button
              onClick={() => {
                useHint();
                playSfx("tap");
                void speakAs("1교시는 국어야. 국어책을 찾아보자.", "haneul");
              }}
              className="btn-soft mx-auto mt-4 block"
            >
              💡 힌트 보기
            </button>
          </div>
        ) : null}

        {/* ── 완료 ── */}
        {step === "done" ? (
          <div className="grid place-items-center pt-8">
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 240, damping: 16 }}
              className="grid place-items-center gap-2"
            >
              <span className="text-[64px]">📖</span>
              <p className="font-round text-[22px] text-ink">1교시 준비 완료!</p>
              <p className="text-[13.5px] text-ink-soft">선생님이 책 이야기를 하신대요</p>
            </motion.div>
            <button className="btn-primary mt-7" onClick={onDone}>
              교실로 가기 ›
            </button>
          </div>
        ) : null}
      </div>

      {/* 하늘이 안내 */}
      <div className="pb-safe pointer-events-none absolute bottom-2 left-3 z-20">
        <NpcAvatar id={CHARACTERS.haneul.id} size={46} tint={CHARACTERS.haneul.tint} speaking={speaking} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-24 z-40 grid place-items-center">
        <AnimatePresence>{toast ? <MissionToast label={toast} onDone={() => setToast(null)} /> : null}</AnimatePresence>
      </div>
    </div>
  );
}

function Clock({ h, m }: { h: number; m: number }) {
  const hourAngle = ((h % 12) + m / 60) * 30;
  const minAngle = m * 6;
  return (
    <svg viewBox="0 0 120 120" width={168} height={168} aria-hidden>
      <circle cx="60" cy="60" r="56" fill="#FFF8ED" stroke="#D2B48C" strokeWidth="6" />
      <circle cx="60" cy="60" r="48" fill="#FFFDF7" />
      {Array.from({ length: 12 }).map((_, i) => (
        <rect
          key={i}
          x="59"
          y="16"
          width="2"
          height="7"
          rx="1"
          fill="#8A7A5F"
          transform={`rotate(${i * 30} 60 60)`}
        />
      ))}
      <line x1="60" y1="60" x2="60" y2="34" stroke="#3A3226" strokeWidth="5" strokeLinecap="round" transform={`rotate(${hourAngle} 60 60)`} />
      <line x1="60" y1="60" x2="60" y2="24" stroke="#FF8B5E" strokeWidth="3.5" strokeLinecap="round" transform={`rotate(${minAngle} 60 60)`} />
      <circle cx="60" cy="60" r="4" fill="#3A3226" />
    </svg>
  );
}
