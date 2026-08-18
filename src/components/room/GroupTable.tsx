"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { MyAvatar, NpcAvatar } from "@/components/ui/Avatar";
import { CHARACTERS } from "@/lib/data/catalog";
import { playSfx } from "@/lib/sfx";
import type { LangCode, SpeakerId } from "@/lib/types";

/**
 * 모둠 책상. 하늘이·준서·선생님·아이가 둘러앉고 말풍선으로 대화한다.
 * 채팅 로그가 아니라 "지금 이 자리에서 오가는 말"로 보이게 하는 게 목적이다.
 *
 * 말풍선을 누르면 가정언어로 바뀐다 — 한국어가 이해 안 될 때의 탈출구.
 */

export interface Said {
  speaker: SpeakerId | "me";
  text: string;
  /** 가정언어 번역. 없으면 번역 버튼을 띄우지 않는다. */
  i18n?: string | null;
}

/** 자리 배치. 위쪽에 선생님, 좌우에 친구들, 아래가 아이. */
const SEAT: Record<SpeakerId | "me", { x: string; y: string; bubble: Anchor }> = {
  teacher: { x: "50%", y: "10%", bubble: "top" },
  haneul: { x: "17%", y: "40%", bubble: "left" },
  junseo: { x: "83%", y: "40%", bubble: "right" },
  me: { x: "50%", y: "84%", bubble: "bottom" },
};

export function GroupTable({
  said,
  speakingAs,
  lang,
  thinkingFor,
  latest,
}: {
  /** 인물별 마지막 발화. 자리 위에 떠 있는다. */
  said: Partial<Record<SpeakerId | "me", Said>>;
  speakingAs: SpeakerId | "me" | null;
  lang: LangCode;
  thinkingFor: SpeakerId | null;
  /**
   * 방금 말한 NPC. 이 사람 말풍선만 띄운다.
   * 390px 화면에 네 명이 동시에 말풍선을 띄우면 서로 겹친다.
   * 아이 말풍선은 자기가 한 말이라 항상 남겨 둔다.
   */
  latest: SpeakerId | null;
}) {
  return (
    <div className="relative h-full w-full">
      {/* 모둠 책상 — 위에서 살짝 내려다본 타원 */}
      <div
        className="absolute left-1/2 top-[55%] h-[124px] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-[50%]"
        style={{
          background: "linear-gradient(180deg,#F0DCBC,#DDC198)",
          boxShadow: "0 10px 0 0 #C4A276, 0 22px 30px -18px rgba(58,50,38,.55)",
        }}
        aria-hidden
      >
        <div
          className="absolute inset-[10px] rounded-[50%]"
          style={{ background: "linear-gradient(180deg,#F7E8CE,#EBD4AE)" }}
        />
        {/* 책상 위 교과서 */}
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[26px] opacity-90">📖</span>
      </div>

      {/* 자리 */}
      {(["teacher", "haneul", "junseo", "me"] as const).map((who) => {
        const seat = SEAT[who];
        const visible = who === "me" || who === latest;
        const line = visible ? said[who] : undefined;
        const isSpeaking = speakingAs === who;
        const isThinking = thinkingFor === who;

        return (
          <div key={who} className="absolute" style={{ left: seat.x, top: seat.y, transform: "translate(-50%,-50%)" }}>
            <div className="grid place-items-center gap-1">
              {who === "me" ? (
                <MyAvatar size={54} speaking={isSpeaking} ring={isSpeaking ? "#FF8B5E" : undefined} />
              ) : (
                <NpcAvatar
                  id={CHARACTERS[who].id}
                  size={who === "teacher" ? 50 : 48}
                  tint={CHARACTERS[who].tint}
                  speaking={isSpeaking}
                  ring={isSpeaking ? CHARACTERS[who].color : undefined}
                />
              )}
              <span className="rounded-full bg-white/85 px-2 py-[1px] text-[10.5px] font-bold text-ink-soft">
                {who === "me" ? "나" : CHARACTERS[who].name}
              </span>
            </div>

            <AnimatePresence>
              {isThinking ? (
                <SpeechBubble key="thinking" anchor={seat.bubble}>
                  <span className="flex items-center gap-1 text-ink-soft">
                    <span className="typing-dot" />
                    <span className="typing-dot" style={{ animationDelay: "0.15s" }} />
                    <span className="typing-dot" style={{ animationDelay: "0.3s" }} />
                  </span>
                </SpeechBubble>
              ) : line ? (
                /*
                 * key 를 대사 내용으로 잡으면 음성 인식 중 글자가 늘 때마다
                 * 말풍선이 새로 생기고 옛것이 빠져나가면서 여러 개가 겹쳐 쌓인다.
                 * 자리마다 하나씩만 두고 내용만 바꿔 끼운다.
                 */
                <TalkBubble
                  key="line"
                  anchor={seat.bubble}
                  said={line}
                  lang={lang}
                  active={isSpeaking}
                  tint={who === "me" ? "#FFE3C2" : "#FFFFFF"}
                />
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 말풍선 위치 — 자리마다 튀어나오는 방향이 다르다.
 *
 * 배치는 바깥 div가, 애니메이션은 안쪽 motion.div가 맡는다.
 * framer-motion 이 transform 을 직접 쓰기 때문에 같은 요소에 -translate-x-1/2 를
 * 걸면 덮어써져서 말풍선이 한쪽으로 밀린다.
 */
const ANCHOR: Record<Anchor, string> = {
  top: "left-1/2 top-[calc(100%+6px)] -translate-x-1/2",
  left: "left-[-14px] top-[calc(100%+6px)]",
  right: "right-[-14px] top-[calc(100%+6px)]",
  bottom: "left-1/2 bottom-[calc(100%+6px)] -translate-x-1/2",
};

type Anchor = "top" | "left" | "right" | "bottom";

const POP = {
  initial: { opacity: 0, y: -6, scale: 0.9 },
  exit: { opacity: 0, scale: 0.92 },
  transition: { type: "spring" as const, stiffness: 320, damping: 24 },
};

function SpeechBubble({ anchor, children }: { anchor: Anchor; children: React.ReactNode }) {
  return (
    <div className={`absolute z-20 w-[150px] ${ANCHOR[anchor]}`}>
      <motion.div
        {...POP}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="rounded-2xl px-2.5 py-2"
        style={{ background: "#FFFFFF", boxShadow: "0 8px 18px -10px rgba(58,50,38,.6)" }}
      >
        {children}
      </motion.div>
    </div>
  );
}

function TalkBubble({
  anchor,
  said,
  lang,
  active,
  tint,
}: {
  anchor: Anchor;
  said: Said;
  lang: LangCode;
  active: boolean;
  tint: string;
}) {
  const [native, setNative] = useState(false);
  const canTranslate = Boolean(said.i18n) && lang !== "ko";

  // 대사가 바뀌면 다시 한국어부터 보여준다.
  useEffect(() => {
    setNative(false);
  }, [said.text]);

  return (
    <div className={`absolute z-20 w-[152px] ${ANCHOR[anchor]}`}>
      <motion.div {...POP} animate={{ opacity: active ? 1 : 0.78, y: 0, scale: 1 }}>
        <button
          onClick={() => {
            if (!canTranslate) return;
            playSfx("tap");
            setNative((v) => !v);
          }}
          className={`w-full rounded-2xl px-2.5 py-2 text-left ${canTranslate ? "tappable" : ""}`}
          style={{ background: native ? "#EFE6FA" : tint, boxShadow: "0 8px 18px -10px rgba(58,50,38,.6)" }}
        >
          <p className={`font-round leading-snug text-ink ${native ? "text-[12.5px]" : "text-[13.5px]"}`}>
            {native ? said.i18n : said.text}
          </p>
          {canTranslate ? (
            <span className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-ink/10 px-1.5 py-[1px] text-[9.5px] font-bold text-ink-soft">
              {native ? "한국어로" : "🌏 모국어"}
            </span>
          ) : null}
        </button>
      </motion.div>
    </div>
  );
}
