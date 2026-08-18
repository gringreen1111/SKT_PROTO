"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { NpcAvatar, MyAvatar } from "@/components/ui/Avatar";
import { MissionToast, NarratorBanner } from "@/components/ui/Bits";
import { Blackboard, Desk, LockerWall, RoomBackdrop, TimetablePoster, WallClock, Window } from "@/components/room/RoomParts";
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
 * v1처럼 교실 전체가 한 화면에 놓이고, 아이가 사물을 직접 눌러서 진행한다.
 * 단계는 있지만 화면이 갈아엎히지 않는다 — 다음에 만질 물건에 빛이 붙을 뿐이다.
 */

type Step = "clock" | "timetable" | "locker" | "done";

const NARRATION: Record<Step, string> = {
  clock: "지금 몇 시일까? 벽에 걸린 시계를 봐.",
  timetable: "8시 40분이야. 곧 1교시가 시작돼. 시간표에 뭐라고 써 있어?",
  locker: "1교시는 국어야. 사물함에서 국어책을 찾아보자!",
  done: "잘했어! 준비 완료 🎉",
};

const NARRATION_I18N: Record<Step, Record<string, string>> = {
  clock: {
    vi: "Bây giờ là mấy giờ nhỉ? Hãy nhìn đồng hồ trên tường.",
    zh: "现在几点了呢？看看墙上的钟。",
    ru: "Который сейчас час? Посмотри на настенные часы.",
    tl: "Anong oras na kaya? Tingnan ang orasan sa dingding.",
  },
  timetable: {
    vi: "Bây giờ là 8 giờ 40. Sắp đến tiết 1 rồi. Thời khóa biểu ghi gì vậy?",
    zh: "现在是8点40分，第一节课快开始了。课程表上写着什么？",
    ru: "Сейчас 8:40. Скоро первый урок. Что написано в расписании?",
    tl: "8:40 na. Malapit nang magsimula ang unang klase. Ano ang nakasulat sa iskedyul?",
  },
  locker: {
    vi: "Tiết 1 là môn Tiếng Hàn. Hãy tìm sách Tiếng Hàn trong tủ nhé!",
    zh: "第一节是国语课。去柜子里找国语书吧！",
    ru: "Первый урок — корейский язык. Найди учебник корейского в шкафчике!",
    tl: "Wikang Korean ang unang klase. Hanapin ang libro sa locker!",
  },
  done: {
    vi: "Giỏi lắm! Chuẩn bị xong rồi 🎉",
    zh: "做得好！准备完成 🎉",
    ru: "Молодец! Всё готово 🎉",
    tl: "Ang galing! Handa na tayo 🎉",
  },
};

export default function Classroom({ onDone }: { onDone: () => void }) {
  const lang = useApp((s) => s.lang);
  const addXp = useApp((s) => s.addXp);
  const addCoins = useApp((s) => s.addCoins);
  const addBadge = useApp((s) => s.addBadge);
  const useHint = useApp((s) => s.useHint);
  const hintsUsed = useApp((s) => s.hintsUsed);

  const [step, setStep] = useState<Step>("clock");
  const [lockerOpen, setLockerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [nudged, setNudged] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [got, setGot] = useState(false);

  // 단계가 바뀌면 하늘이가 상황을 읽어준다.
  useEffect(() => {
    let alive = true;
    setSpeaking(true);
    void speakAs(NARRATION[step], "haneul").then(() => {
      if (alive) setSpeaking(false);
    });
    return () => {
      alive = false;
    };
  }, [step]);

  const finish = useCallback(() => {
    addBadge("timetable");
    // 힌트 없이 왔으면 "스스로 해냈어요" 도 같이 준다.
    if (hintsUsed === 0) addBadge("selfsolve");
    addXp(10);
    addCoins(8);
    playSfx("star");
    setToast("시간표 마스터");
  }, [addBadge, addXp, addCoins, hintsUsed]);

  return (
    <div className="relative h-full overflow-hidden">
      <RoomBackdrop />

      {/* ── 벽에 걸린 것들 ── */}
      <Blackboard date={TODAY_LABEL} line="1학년 3반 · 1교시 국어" />

      <TimetablePoster
        hint={step === "timetable"}
        onPress={() => {
          playSfx("page");
          setSheetOpen(true);
          if (step === "timetable") setStep("locker");
        }}
      />

      <WallClock
        h={CLOCK_TIME.h}
        m={CLOCK_TIME.m}
        hint={step === "clock"}
        onPress={() => {
          playSfx("tap");
          void speakAs("여덟 시 사십 분이야.", "haneul");
          if (step === "clock") setStep("timetable");
        }}
      />

      <Window x="50%" y="38%" w={104} />

      {/* ── 교실 안 사람들 ── */}
      <div className="absolute left-[13%] top-[41%]">
        <NpcAvatar id={CHARACTERS.teacher.id} size={42} tint={CHARACTERS.teacher.tint} />
      </div>
      <div className="absolute right-[15%] top-[43%]">
        <NpcAvatar id={CHARACTERS.junseo.id} size={36} tint={CHARACTERS.junseo.tint} />
      </div>

      <Desk x="20%" y="53%" scale={0.85} />
      <Desk x="78%" y="55%" scale={0.85} />
      <Desk x="49%" y="50%" scale={0.7} />

      {/* ── 사물함 ── */}
      <LockerWall
        open={lockerOpen}
        books={LOCKER_BOOKS}
        correct={CORRECT_BOOK}
        hint={step === "locker"}
        nudged={nudged}
        onOpen={() => {
          playSfx("page");
          setLockerOpen(true);
          void speakAs("사물함을 열었어. 어떤 책이 필요할까?", "haneul");
        }}
        onPick={(b) => {
          if (b === CORRECT_BOOK) {
            playSfx("correct");
            setGot(true);
            setStep("done");
            finish();
            return;
          }
          // 틀렸다는 표시를 하지 않는다. 책이 살짝 흔들리고 하늘이가 넘겨준다.
          playSfx("tap");
          setNudged(b);
          void speakAs("음… 지금은 그 시간이 아닌 것 같아.", "haneul");
          setTimeout(() => setNudged(null), 420);
        }}
      />

      {/* ── 하늘이: 아이 옆에 서서 안내한다 ── */}
      <div className="pb-safe absolute bottom-[3%] left-3 flex items-end gap-2">
        <NpcAvatar id={CHARACTERS.haneul.id} size={48} tint={CHARACTERS.haneul.tint} speaking={speaking} />
        <MyAvatar size={40} />
      </div>

      {/* ── 내레이터 배너 ── */}
      <div className="pointer-events-none absolute inset-x-0 top-[27%] z-30">
        <AnimatePresence mode="wait">
          <NarratorBanner
            key={step}
            text={NARRATION[step]}
            translated={NARRATION_I18N[step][lang] ?? null}
            lang={lang}
          />
        </AnimatePresence>
      </div>

      {/* ── 힌트 ── */}
      {step !== "done" ? (
        <button
          onClick={() => {
            useHint();
            playSfx("tap");
            void speakAs(NARRATION[step], "haneul");
          }}
          className="pb-safe tappable absolute bottom-[3%] right-3 rounded-full bg-white/80 px-3 py-2 text-[12.5px] font-bold text-ink-soft"
        >
          💡 힌트
        </button>
      ) : null}

      {/* ── 국어책을 얻었을 때 ── */}
      <AnimatePresence>
        {got ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-50 grid place-items-center bg-ink/35 backdrop-blur-[2px]"
          >
            <motion.div
              initial={{ scale: 0.7, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 240, damping: 16 }}
              className="grid place-items-center gap-2 rounded-3xl bg-cream px-8 py-7"
            >
              <span className="text-[58px]">📖</span>
              <p className="font-round text-[22px] text-ink">1교시 준비 완료!</p>
              <p className="text-[13px] text-ink-soft">선생님이 책 이야기를 하신대요</p>
              <button className="btn-primary mt-3" onClick={onDone}>
                모둠으로 가기 ›
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ── 시간표 상세 ── */}
      <AnimatePresence>
        {sheetOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 z-40 grid place-items-center bg-ink/40 px-6 backdrop-blur-[2px]"
          >
            <motion.div
              initial={{ scale: 0.9, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-3xl bg-cream p-4"
              style={{ boxShadow: "0 20px 40px -18px rgba(58,50,38,.7)" }}
            >
              <p className="mb-2 text-center font-round text-[19px] text-ink">시간표</p>
              <div className="grid gap-1.5">
                {TIMETABLE.map((row) => {
                  const s = SUBJECTS[row.subject];
                  const first = row.no === 1;
                  return (
                    <button
                      key={row.no}
                      onClick={() => {
                        playSfx("tap");
                        void speakAs(`${row.label}는 ${row.subject}야.`, "haneul");
                      }}
                      className={`tappable flex items-center gap-2.5 rounded-2xl px-2.5 py-2 text-left ${first ? "glow-hint" : ""}`}
                      style={{ background: first ? "#FFF3DE" : "rgba(255,255,255,.6)" }}
                    >
                      <span className="w-[38px] shrink-0 text-[12px] font-bold text-ink-soft">{row.label}</span>
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[16px]"
                        style={{ background: s.color, boxShadow: `0 3px 0 0 ${s.colorDark}` }}
                      >
                        {s.iconChar}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-round text-[16px] text-ink">{row.subject}</span>
                        <span className="block truncate text-[11px] text-ink-soft">
                          {SUBJECT_HINT[row.subject]?.[lang] ?? SUBJECT_HINT[row.subject]?.ko}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11.5px] font-bold text-ink-soft">{row.time}</span>
                    </button>
                  );
                })}
              </div>
              <button className="btn-soft mx-auto mt-3 block" onClick={() => setSheetOpen(false)}>
                닫기
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-x-0 top-[46%] z-40 grid place-items-center">
        <AnimatePresence>{toast ? <MissionToast label={toast} onDone={() => setToast(null)} /> : null}</AnimatePresence>
      </div>
    </div>
  );
}
