"use client";

import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { MyAvatar } from "@/components/ui/Avatar";
import { BADGES, GROWTH_STAGES, growthStage, levelOf } from "@/lib/data/catalog";
import { playSfx } from "@/lib/sfx";
import { clearSaved, useApp } from "@/lib/store";

/** §3 그대로 유지 — 경험치 / 코인 / 뱃지 / "오늘 내가 한 말" / 성장 단계 / 다음 미션 예고. */
export default function Reward({ onRestart }: { onRestart: () => void }) {
  const name = useApp((s) => s.name);
  const xp = useApp((s) => s.xp);
  const coins = useApp((s) => s.coins);
  const badges = useApp((s) => s.badges);
  const myLine = useApp((s) => s.myLine);
  const reset = useApp((s) => s.reset);

  const lv = levelOf(xp);
  const stage = growthStage(lv.level);

  useEffect(() => {
    playSfx("chime");
    const t = setTimeout(() => {
      void confetti({ particleCount: 90, spread: 72, origin: { y: 0.32 }, colors: ["#FF8B5E", "#FFD98A", "#7FD1AE", "#A8D8EA"] });
    }, 260);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-gradient-to-b from-[#FFF3DE] to-[#FFE0BF]">
      <motion.div
        className="pointer-events-none absolute left-1/2 top-[-140px] h-[420px] w-[420px] -translate-x-1/2 opacity-40"
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        aria-hidden
      >
        <svg viewBox="0 0 200 200" className="h-full w-full">
          {Array.from({ length: 12 }).map((_, i) => (
            <path key={i} d="M100 100 L92 0 L108 0 Z" fill="#FFD98A" opacity="0.5" transform={`rotate(${i * 30} 100 100)`} />
          ))}
        </svg>
      </motion.div>

      <div className="relative flex-1 overflow-y-auto no-scrollbar px-4 pb-3 pt-safe">
        <div className="grid place-items-center pt-4">
          <MyAvatar size={104} ring="#FFFFFF" />
          <p className="mt-2 font-round text-[24px] text-ink">오늘 잘 해냈어!</p>
          <p className="text-[13.5px] text-ink-soft">{name || "친구"} · 학교가 즐거워지는 연습</p>
        </div>

        {/* 경험치 */}
        <div className="card mt-5 p-3.5">
          <div className="flex items-baseline justify-between">
            <p className="font-round text-[17px] text-ink">경험치 Lv.{lv.level}</p>
            <p className="text-[13px] font-bold text-ink-soft">
              {xp} / {lv.next}
            </p>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-ink/10">
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg,#FFA276,#FF8B5E)" }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(lv.ratio * 100)}%` }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Sprout stage={stage} />
            <div>
              <p className="font-round text-[17px] text-ink">{GROWTH_STAGES[stage]}</p>
              <p className="text-[12.5px] text-ink-soft">성장 단계 {stage + 1} / {GROWTH_STAGES.length}</p>
            </div>
            <span className="ml-auto flex items-center gap-1 rounded-full bg-[#FFF3DE] px-3 py-1.5 font-round text-[17px] text-ink">
              🪙 {coins}
            </span>
          </div>
        </div>

        {/* 뱃지 */}
        <div className="mt-4">
          <p className="mb-2 font-round text-[17px] text-ink">받은 뱃지 {badges.length}</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(BADGES).map((b) => {
              const got = badges.includes(b.id);
              return (
                <div
                  key={b.id}
                  className="flex items-center gap-2 rounded-2xl px-2.5 py-2"
                  style={{ background: got ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.4)", opacity: got ? 1 : 0.55 }}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#FFF3DE] text-[18px]">
                    {got ? b.iconChar : "🔒"}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-round text-[14.5px] leading-tight text-ink">{b.label}</span>
                    <span className="block text-[11px] leading-tight text-ink-soft">{b.desc}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 오늘 내가 한 말 */}
        {myLine ? (
          <div className="mt-4 rounded-3xl border-2 border-dashed border-ink/15 bg-white/55 p-3.5">
            <p className="mb-1 text-[12.5px] font-bold text-ink-soft">오늘 내가 한 말</p>
            <p className="font-round text-[19px] leading-snug text-ink">“{myLine}”</p>
          </div>
        ) : null}

        {/* 다음 미션 */}
        <div className="mt-4 flex items-center gap-3 rounded-3xl border-2 border-dashed border-ink/15 bg-white/45 px-4 py-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/70 text-[24px]">🍽️</span>
          <div className="min-w-0 flex-1">
            <p className="font-round text-[16px] leading-tight text-ink">다음 미션 · 급식실 가기</p>
            <p className="text-[12.5px] text-ink-soft">줄 서기, 식판 받기, 자리 찾기</p>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-ink/10 px-2.5 py-1 text-[11.5px] font-bold text-ink-soft">
            🔒 준비 중
          </span>
        </div>

        <div className="mb-4 mt-6">
          <button
            className="btn-primary w-full"
            onClick={() => {
              playSfx("chime");
              clearSaved();
              reset();
              onRestart();
            }}
          >
            처음부터 다시
          </button>
        </div>
      </div>
    </div>
  );
}

function Sprout({ stage, size = 56 }: { stage: number; size?: number }) {
  const spring = { type: "spring" as const, stiffness: 180, damping: 14 };
  return (
    <svg viewBox="0 0 80 88" width={size} height={(size * 88) / 80} aria-label={`성장 단계 ${stage + 1}`}>
      <defs>
        <linearGradient id="potG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F0A87C" />
          <stop offset="100%" stopColor="#D2794F" />
        </linearGradient>
        <linearGradient id="leafG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9BE0BE" />
          <stop offset="100%" stopColor="#5FB794" />
        </linearGradient>
      </defs>
      <ellipse cx="40" cy="56" rx="21" ry="6" fill="#7A5B3C" />
      {stage >= 1 ? (
        <motion.rect initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={spring} x="38" y="30" width="4" height="26" rx="2" fill="#5FB794" style={{ originY: 1 }} />
      ) : null}
      {stage >= 1 ? <motion.ellipse initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring} cx="29" cy="36" rx="10" ry="6" fill="url(#leafG)" /> : null}
      {stage >= 2 ? <motion.ellipse initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring} cx="51" cy="30" rx="10" ry="6" fill="url(#leafG)" /> : null}
      {stage >= 3 ? (
        <motion.g initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring}>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="40" cy="20" rx="5" ry="8" fill="#FFB8CB" transform={`rotate(${a} 40 26)`} />
          ))}
          <circle cx="40" cy="26" r="4.5" fill="#FFDE86" />
        </motion.g>
      ) : null}
      {stage === 0 ? <ellipse cx="40" cy="44" rx="7" ry="9" fill="#C99A6B" /> : null}
      <path d="M22 56h36l-4 24H26z" fill="url(#potG)" />
      <rect x="19" y="52" width="42" height="9" rx="4" fill="#E0955F" />
    </svg>
  );
}
