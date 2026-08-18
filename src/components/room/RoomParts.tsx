"use client";

import { motion } from "framer-motion";
import { SUBJECTS } from "@/lib/data/catalog";

/**
 * 교실을 구성하는 사물들. 전부 화면에 동시에 놓이고, 아이가 직접 눌러서 만진다.
 * v1의 시연 환경처럼 "한 페이지에 교실이 있다"는 느낌을 만드는 게 목적이다.
 */

/** 벽 + 바닥. 교실의 바탕. */
export function RoomBackdrop() {
  return (
    <div className="absolute inset-0" aria-hidden>
      {/* 벽 */}
      <div className="absolute inset-x-0 top-0 h-[62%]" style={{ background: "linear-gradient(180deg,#FDF0DA,#F7E4C8)" }} />
      {/* 걸레받이 */}
      <div className="absolute inset-x-0 top-[62%] h-[10px]" style={{ background: "#E0C6A0" }} />
      {/* 바닥 — 원근감을 주는 마루 */}
      <div className="absolute inset-x-0 bottom-0 top-[calc(62%+10px)] overflow-hidden" style={{ background: "linear-gradient(180deg,#E8CFA8,#D9B98A)" }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="absolute inset-y-0"
            style={{
              left: `${(i / 8) * 140 - 20}%`,
              width: 2,
              background: "rgba(160,120,80,.22)",
              transform: `skewX(${(i - 4) * 5}deg)`,
            }}
          />
        ))}
      </div>
      {/* 창문 빛 */}
      <div
        className="absolute left-[-10%] top-0 h-[52%] w-[52%] opacity-55"
        style={{ background: "radial-gradient(60% 70% at 20% 10%, rgba(255,255,255,.95), transparent 70%)" }}
      />
    </div>
  );
}

/** 칠판. 오늘 날짜와 반이 적혀 있다. */
export function Blackboard({ date, line }: { date: string; line: string }) {
  return (
    // 좌우로 시간표(≤22%)와 시계(≥78%)가 걸려 있어 폭을 그 사이로 제한한다.
    <div
      className="absolute left-1/2 top-[7%] w-[50%] -translate-x-1/2 rounded-[10px] px-2.5 py-2"
      style={{ background: "#3E6B52", boxShadow: "0 6px 0 0 #2E5140, 0 12px 22px -12px rgba(58,50,38,.6)", border: "4px solid #C9A87C" }}
    >
      <p className="text-[10px] font-bold text-[#BEE3CC]">{date}</p>
      <p className="mt-0.5 font-round text-[13.5px] leading-tight text-[#F2FBF5]">{line}</p>
    </div>
  );
}

/** 벽시계. 누르면 시각을 읽어준다. */
export function WallClock({
  h,
  m,
  hint,
  onPress,
  size = 74,
}: {
  h: number;
  m: number;
  hint?: boolean;
  onPress?: () => void;
  size?: number;
}) {
  const hourAngle = ((h % 12) + m / 60) * 30;
  const minAngle = m * 6;
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onPress}
      aria-label={`벽시계 ${h}시 ${m}분`}
      className={`absolute right-[3%] top-[6%] ${onPress ? "tappable" : ""} ${hint ? "glow-hint" : ""}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 120 120" className="h-full w-full">
        <circle cx="60" cy="60" r="56" fill="#FFF8ED" stroke="#C9A87C" strokeWidth="7" />
        <circle cx="60" cy="60" r="47" fill="#FFFDF7" />
        {Array.from({ length: 12 }).map((_, i) => (
          <rect key={i} x="59" y="17" width="2.4" height="7" rx="1.2" fill="#8A7A5F" transform={`rotate(${i * 30} 60 60)`} />
        ))}
        <line x1="60" y1="60" x2="60" y2="35" stroke="#3A3226" strokeWidth="6" strokeLinecap="round" transform={`rotate(${hourAngle} 60 60)`} />
        <line x1="60" y1="60" x2="60" y2="25" stroke="#FF8B5E" strokeWidth="4" strokeLinecap="round" transform={`rotate(${minAngle} 60 60)`} />
        <circle cx="60" cy="60" r="4.5" fill="#3A3226" />
      </svg>
    </motion.button>
  );
}

/** 벽에 붙은 시간표 포스터. 살짝 기울어져 있다. */
export function TimetablePoster({
  hint,
  onPress,
}: {
  hint?: boolean;
  onPress?: () => void;
}) {
  return (
    // rotate 는 style 이 아니라 framer 쪽에 준다 — 같은 요소의 transform 을 framer 가 덮어쓴다.
    <motion.button
      initial={{ rotate: -2.6 }}
      whileTap={{ scale: 0.93, rotate: -2.6 }}
      onClick={onPress}
      aria-label="시간표 보기"
      className={`absolute left-[3%] top-[6%] w-[72px] rounded-[8px] p-1.5 ${onPress ? "tappable" : ""} ${hint ? "glow-hint" : ""}`}
      style={{ background: "#FFFDF7", boxShadow: "0 5px 12px -6px rgba(58,50,38,.5)", border: "2px solid #E6D3B4" }}
    >
      <p className="mb-1 font-round text-[10.5px] leading-none text-ink">시간표</p>
      <div className="grid gap-[3px]">
        {["국어", "수학", "통합교과", "체육"].map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <span className="w-[8px] text-[7px] font-bold text-ink-soft">{i + 1}</span>
            <span className="h-[9px] flex-1 rounded-[2px]" style={{ background: SUBJECTS[s].color, opacity: i === 0 ? 1 : 0.42 }} />
          </div>
        ))}
      </div>
      {/* 압정 */}
      <span className="absolute left-1/2 top-[-4px] h-[8px] w-[8px] -translate-x-1/2 rounded-full" style={{ background: "#E8604C", boxShadow: "0 1px 2px rgba(0,0,0,.3)" }} />
    </motion.button>
  );
}

/**
 * 사물함. 문이 열리면 안쪽에 교과서가 보이고, 아이가 책을 직접 집는다.
 */
export function LockerWall({
  open,
  books,
  correct,
  hint,
  nudged,
  onOpen,
  onPick,
}: {
  open: boolean;
  books: string[];
  correct: string;
  hint?: boolean;
  nudged: string | null;
  onOpen: () => void;
  onPick: (subject: string) => void;
}) {
  return (
    <div className="absolute bottom-[16%] left-1/2 w-[86%] -translate-x-1/2">
      <div
        className="relative rounded-[10px] p-2"
        style={{ background: "linear-gradient(180deg,#D7B98F,#C4A276)", boxShadow: "0 8px 0 0 #A98757, 0 16px 26px -14px rgba(58,50,38,.55)" }}
      >
        {!open ? (
          // ── 닫힌 사물함: 문 6칸 ──
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onOpen}
            aria-label="사물함 열기"
            className={`grid w-full grid-cols-3 gap-1.5 ${hint ? "glow-hint" : ""} tappable`}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className="relative grid h-[42px] place-items-center rounded-[6px]"
                style={{ background: "linear-gradient(180deg,#F0DCBC,#E2C9A2)", boxShadow: "inset 0 1px rgba(255,255,255,.7), 0 2px 0 0 #B99A6E" }}
              >
                <span className="absolute right-1.5 h-[7px] w-[7px] rounded-full" style={{ background: "#8A7A5F" }} />
                <span className="absolute left-1.5 top-1 text-[8px] font-bold text-ink-soft/60">{i + 1}</span>
              </span>
            ))}
          </motion.button>
        ) : (
          // ── 열린 사물함: 교과서가 꽂혀 있다 ──
          <motion.div
            initial={{ opacity: 0, scaleY: 0.9 }}
            animate={{ opacity: 1, scaleY: 1 }}
            className="grid grid-cols-3 gap-1.5"
            style={{ transformOrigin: "top" }}
          >
            {books.map((b) => {
              const s = SUBJECTS[b];
              const right = b === correct;
              return (
                <motion.button
                  key={b}
                  animate={nudged === b ? { rotate: [0, -4, 4, 0] } : {}}
                  transition={{ duration: 0.35 }}
                  onClick={() => onPick(b)}
                  aria-label={`${b} 교과서`}
                  className={`tappable relative grid h-[42px] place-items-center overflow-hidden rounded-[6px] ${right && hint ? "glow-hint" : ""}`}
                  style={{ background: "#4A3A28", boxShadow: "inset 0 2px 6px rgba(0,0,0,.45)" }}
                >
                  {/* 책등 */}
                  <span
                    className="absolute inset-y-[5px] left-1/2 w-[26px] -translate-x-1/2 rounded-[3px]"
                    style={{ background: s.color, boxShadow: `inset -3px 0 0 0 ${s.colorDark}` }}
                  />
                  <span className="relative text-[15px]">{s.iconChar}</span>
                  <span className="absolute bottom-[2px] font-round text-[9px] text-white/95">{b}</span>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </div>
      {/* 마룻바닥 위라 글씨가 묻힌다. 밝은 알약을 깔아 대비를 준다. */}
      <p className="mx-auto mt-1.5 w-fit rounded-full bg-white/85 px-2.5 py-1 text-center text-[11px] font-bold text-ink-soft">
        {open ? "필요한 책을 눌러보세요" : "사물함을 눌러 열어보세요"}
      </p>
    </div>
  );
}

/** 창문. 빈 벽을 채우고 교실이라는 걸 알려준다. 장식이라 누를 수 없다. */
export function Window({ x = "50%", y = "34%", w = 108 }: { x?: string; y?: string; w?: number }) {
  return (
    <div
      className="absolute"
      style={{ left: x, top: y, width: w, transform: "translate(-50%,-50%)" }}
      aria-hidden
    >
      <div
        className="relative overflow-hidden rounded-[8px]"
        style={{ height: w * 0.72, background: "linear-gradient(180deg,#BFE6F5,#E8F6DC 68%,#CFE9AE)", border: "5px solid #E8D2AE", boxShadow: "0 6px 14px -8px rgba(58,50,38,.45)" }}
      >
        {/* 구름 */}
        <span className="absolute left-[14%] top-[16%] h-[9px] w-[24px] rounded-full bg-white/85" />
        <span className="absolute left-[52%] top-[26%] h-[7px] w-[18px] rounded-full bg-white/70" />
        {/* 나무 */}
        <span className="absolute bottom-[6%] left-[22%] h-[16px] w-[16px] rounded-full" style={{ background: "#7FC08A" }} />
        <span className="absolute bottom-[4%] right-[20%] h-[12px] w-[12px] rounded-full" style={{ background: "#95CE9C" }} />
        {/* 창틀 */}
        <span className="absolute inset-y-0 left-1/2 w-[4px] -translate-x-1/2" style={{ background: "#E8D2AE" }} />
        <span className="absolute inset-x-0 top-1/2 h-[4px] -translate-y-1/2" style={{ background: "#E8D2AE" }} />
      </div>
    </div>
  );
}

/** 책상 하나. 교실에 깊이를 준다. */
export function Desk({ x, y, scale = 1 }: { x: string; y: string; scale?: number }) {
  return (
    <div className="absolute" style={{ left: x, top: y, transform: `translate(-50%,-50%) scale(${scale})` }} aria-hidden>
      <div className="h-[16px] w-[54px] rounded-[4px]" style={{ background: "#E8C89A", boxShadow: "0 3px 0 0 #C4A276" }} />
      <div className="mx-auto h-[13px] w-[40px]" style={{ background: "linear-gradient(180deg,#C9A87C,#B08F63)" }} />
    </div>
  );
}
