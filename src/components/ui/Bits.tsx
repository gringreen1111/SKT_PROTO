"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { LangCode } from "@/lib/types";

/** 말풍선. 화자에 따라 좌우가 바뀐다. */
export function Bubble({
  text,
  side = "left",
  tint = "#FFFFFF",
  sub,
}: {
  text: string;
  side?: "left" | "right";
  tint?: string;
  sub?: string | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className={`max-w-[76%] rounded-3xl px-4 py-2.5 ${side === "right" ? "rounded-br-lg" : "rounded-bl-lg"}`}
      style={{ background: tint, boxShadow: "0 6px 16px -10px rgba(58,50,38,.55)" }}
    >
      <p className="font-round text-[17px] leading-snug text-ink">{text}</p>
      {sub ? <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">{sub}</p> : null}
    </motion.div>
  );
}

/** "생각 중…" — 스피너·프로그레스바는 쓰지 않는다(§4.4). */
export function Thinking({ label = "생각 중…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-3xl rounded-bl-lg bg-white/85 px-4 py-3 text-ink-soft">
      <span className="typing-dot" />
      <span className="typing-dot" style={{ animationDelay: "0.15s" }} />
      <span className="typing-dot" style={{ animationDelay: "0.3s" }} />
      <span className="ml-1 text-[13px] font-bold">{label}</span>
    </div>
  );
}

/**
 * §4.2 내레이터 배너 — 텍스트 전용, 음성 없음.
 * 모국어 보기 토글을 여기 붙인다.
 */
export function NarratorBanner({
  text,
  translated,
  lang,
}: {
  text: string;
  translated?: string | null;
  lang: LangCode;
}) {
  const [showNative, setShowNative] = useState(false);
  const canTranslate = Boolean(translated) && lang !== "ko";

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="pointer-events-auto mx-3 rounded-2xl bg-ink/78 px-3.5 py-2 backdrop-blur-sm"
    >
      <div className="flex items-start gap-2">
        <span className="mt-[1px] text-[13px]">💬</span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-bold leading-snug text-cream">{showNative && canTranslate ? translated : text}</p>
        </div>
        {canTranslate ? (
          <button
            onClick={() => setShowNative((v) => !v)}
            className="tappable shrink-0 rounded-full bg-white/22 px-2 py-1 text-[11px] font-bold text-cream"
          >
            {showNative ? "한국어" : "🌏 모국어"}
          </button>
        ) : null}
      </div>
    </motion.div>
  );
}

/** 미션 클리어 토스트. */
export function MissionToast({ label, onDone }: { label: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1900);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 280, damping: 18 }}
      className="pointer-events-none rounded-full bg-white px-5 py-2.5 shadow-lg"
    >
      <p className="font-round text-[17px] text-ink">🏅 미션 클리어! · {label}</p>
    </motion.div>
  );
}

/** 마이크 버튼. 듣는 동안 입력 레벨로 링이 커진다. */
export function MicButton({
  listening,
  level,
  disabled,
  onPress,
  label,
}: {
  listening: boolean;
  level: number;
  disabled?: boolean;
  onPress: () => void;
  label: string;
}) {
  const scale = 1 + Math.min(0.45, level * 0.5);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative grid place-items-center">
        {listening ? (
          <motion.span
            className="absolute rounded-full bg-accent/25"
            style={{ width: 78, height: 78 }}
            animate={{ scale }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
          />
        ) : null}
        <motion.button
          whileTap={{ scale: 0.9 }}
          disabled={disabled}
          onClick={onPress}
          aria-label={label}
          className={`relative grid h-[70px] w-[70px] place-items-center rounded-full text-[30px] ${
            disabled ? "opacity-55" : "tappable"
          }`}
          style={{
            background: listening
              ? "linear-gradient(180deg,#FFC08F,#FF8B5E)"
              : "linear-gradient(180deg,#FFA276,#FF8B5E 55%,#F5794C)",
            boxShadow: "0 5px 0 0 #D95F2F, 0 12px 24px -10px rgba(217,95,47,.8)",
          }}
        >
          🎤
        </motion.button>
      </div>
      <p className="text-[13px] font-bold text-ink-soft">{label}</p>
    </div>
  );
}

/** 화면 전환 래퍼. */
export function SceneFade({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={k}
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.01 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="absolute inset-0"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
