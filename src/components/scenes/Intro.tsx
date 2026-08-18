"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { MyAvatar, NpcAvatar } from "@/components/ui/Avatar";
import {
  ACCESSORIES,
  BG_COLORS,
  CHARACTERS,
  FACES,
  LANGUAGES,
  NAME_SUGGESTIONS,
  randomLook,
} from "@/lib/data/catalog";
import { playSfx } from "@/lib/sfx";
import { speakAs, voiceEngine } from "@/lib/speech/tts";
import { useApp } from "@/lib/store";

/**
 * §3 그대로 유지 — 이름 → 얼굴 → 꾸미기 → 색깔 → 가정언어 → 소리 확인.
 * 재작성 금지 대상이라 v1의 단계 구성과 문구를 그대로 옮겼다.
 */

type Step = "name" | "face" | "acc" | "color" | "lang" | "sound";
const STEPS: Step[] = ["name", "face", "acc", "color", "lang", "sound"];

const TITLE: Record<Step, string> = {
  name: "이름을 지어주세요",
  face: "얼굴",
  acc: "꾸미기",
  color: "색깔",
  lang: "집에서 쓰는 말은?",
  sound: "소리 확인하기",
};

export default function Intro({ onDone }: { onDone: () => void }) {
  const name = useApp((s) => s.name);
  const look = useApp((s) => s.look);
  const lang = useApp((s) => s.lang);
  const setName = useApp((s) => s.setName);
  const setLook = useApp((s) => s.setLook);
  const setLang = useApp((s) => s.setLang);

  const [step, setStep] = useState<Step>("name");
  const [heard, setHeard] = useState(false);

  const idx = STEPS.indexOf(step);
  const go = (dir: 1 | -1) => {
    playSfx("page");
    const next = STEPS[Math.min(STEPS.length - 1, Math.max(0, idx + dir))];
    setStep(next);
  };

  const canNext =
    step === "name" ? name.trim().length > 0 : step === "sound" ? true : true;

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#FFF3DE] to-[#FFE3C6]">
      <header className="pt-safe px-4 pb-1">
        <div className="flex items-center gap-2 pt-2">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className="h-1.5 flex-1 rounded-full transition-colors"
              style={{ background: i <= idx ? "#FF8B5E" : "rgba(58,50,38,.13)" }}
            />
          ))}
        </div>
        <h1 className="mt-3 font-round text-[24px] text-ink">{TITLE[step]}</h1>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-2">
        <div className="mb-4 mt-1 grid place-items-center">
          <MyAvatar size={112} ring="#FFFFFF" />
          {name ? <p className="mt-2 font-round text-[19px] text-ink">{name}</p> : null}
        </div>

        {step === "name" ? (
          <div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={8}
              placeholder="캐릭터 이름"
              className="w-full rounded-2xl border-2 border-ink/12 bg-white/85 px-4 py-3 text-center font-round text-[22px] text-ink outline-none focus:border-accent"
            />
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {NAME_SUGGESTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    playSfx("tap");
                    setName(n);
                  }}
                  className="tappable rounded-full bg-white/80 px-3.5 py-2 font-round text-[16px] text-ink"
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                playSfx("pop");
                setLook(randomLook());
              }}
              className="btn-soft mx-auto mt-4 block"
            >
              🎲 아무거나 만들기
            </button>
          </div>
        ) : null}

        {step === "face" ? (
          <div className="grid grid-cols-4 gap-2.5">
            {FACES.map((f) => (
              <button
                key={f}
                onClick={() => {
                  playSfx("tap");
                  setLook({ face: f });
                }}
                className="tappable grid place-items-center rounded-2xl bg-white/70 p-1.5"
                style={look.face === f ? { boxShadow: "0 0 0 3px #FF8B5E" } : undefined}
                aria-label={`얼굴 ${f}`}
              >
                <MyAvatar look={{ ...look, face: f }} size={58} />
              </button>
            ))}
          </div>
        ) : null}

        {step === "acc" ? (
          <div className="grid grid-cols-3 gap-2.5">
            {ACCESSORIES.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  playSfx("tap");
                  setLook({ acc: a.id });
                }}
                className="tappable grid place-items-center gap-1 rounded-2xl bg-white/70 p-2"
                style={look.acc === a.id ? { boxShadow: "0 0 0 3px #FF8B5E" } : undefined}
              >
                <MyAvatar look={{ ...look, acc: a.id }} size={56} />
                <span className="font-round text-[15px] text-ink">{a.name}</span>
              </button>
            ))}
          </div>
        ) : null}

        {step === "color" ? (
          <div className="grid grid-cols-4 gap-2.5">
            {BG_COLORS.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  playSfx("tap");
                  setLook({ bg: c.id });
                }}
                className="tappable grid place-items-center gap-1 rounded-2xl bg-white/60 p-2"
                style={look.bg === c.id ? { boxShadow: "0 0 0 3px #FF8B5E" } : undefined}
              >
                <span
                  className="h-9 w-9 rounded-full"
                  style={{ background: `linear-gradient(160deg, ${c.from}, ${c.to})` }}
                />
                <span className="text-[12px] font-bold text-ink-soft">{c.name}</span>
              </button>
            ))}
          </div>
        ) : null}

        {step === "lang" ? (
          <div className="grid gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => {
                  playSfx("tap");
                  setLang(l.code);
                }}
                className="tappable flex items-center gap-3 rounded-2xl bg-white/78 px-3.5 py-3 text-left"
                style={lang === l.code ? { boxShadow: "0 0 0 3px #FF8B5E" } : undefined}
              >
                <span className="text-[24px]">{l.flagChar}</span>
                <span className="flex-1">
                  <span className="block font-round text-[18px] text-ink">{l.label}</span>
                  <span className="block text-[12.5px] text-ink-soft">{l.native}</span>
                </span>
              </button>
            ))}
            <p className="mt-1 px-1 text-[12.5px] leading-snug text-ink-soft">
              어려운 말이 나오면 <b>🌏 모국어로 보기</b> 를 눌러 이 말로 볼 수 있어요
            </p>
          </div>
        ) : null}

        {step === "sound" ? (
          <div className="grid gap-3">
            <div className="card flex items-center gap-3 p-3.5">
              <NpcAvatar id={CHARACTERS.haneul.id} size={54} tint={CHARACTERS.haneul.tint} speaking={heard} />
              <div className="min-w-0 flex-1">
                <p className="font-round text-[17px] leading-snug text-ink">안녕! 나는 하늘이야. 잘 들리니?</p>
                <p className="mt-0.5 text-[12px] text-ink-soft">친구들 목소리가 나오는지 미리 들어볼 수 있어요</p>
              </div>
            </div>
            <button
              className="btn-primary w-full"
              onClick={async () => {
                playSfx("tap");
                setHeard(true);
                await speakAs("안녕! 나는 하늘이야. 잘 들리니?", "haneul");
                setHeard(false);
              }}
            >
              🔊 들어보기
            </button>
            <p className="px-1 text-center text-[12.5px] leading-snug text-ink-soft">
              {voiceEngine.supported
                ? "안 들리면 폰의 무음(진동) 모드와 볼륨을 확인해 주세요"
                : "이 브라우저는 목소리를 지원하지 않아요 · 글자로 진행할 수 있어요"}
            </p>
          </div>
        ) : null}
      </div>

      <footer className="pb-safe flex items-center gap-2 px-4 pb-3 pt-1">
        {idx > 0 ? (
          <button onClick={() => go(-1)} className="btn-soft" aria-label="이전">
            ‹ 뒤로
          </button>
        ) : null}
        <motion.button
          whileTap={{ scale: 0.97 }}
          disabled={!canNext}
          className="btn-primary flex-1"
          onClick={() => {
            if (step === "sound") {
              playSfx("chime");
              void speakAs(`${name || "친구"}, 학교에 가볼까?`, "haneul");
              onDone();
              return;
            }
            go(1);
          }}
        >
          {step === "sound" ? "학교 가기 🏫" : "다음 ›"}
        </motion.button>
      </footer>
    </div>
  );
}
