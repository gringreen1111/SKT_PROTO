"use client";

import { useState } from "react";
import type { EngineChoice, TurnOutcome } from "@/lib/engine/api-engine";
import { MOCK_STT, sttStatus } from "@/lib/speech/stt";
import { voiceEngine } from "@/lib/speech/tts";

/**
 * §9-7 ?dev=1 패널 — 엔진 강제 전환, 응답 원문 보기, 지연 시간 표시.
 * 아이 화면에는 절대 뜨지 않는다. ?dev=1 일 때만 마운트한다.
 */
export function DevPanel({
  engine,
  setEngine,
  last,
  onSkip,
}: {
  engine: EngineChoice;
  setEngine: (e: EngineChoice) => void;
  last: TurnOutcome | null;
  onSkip: () => void;
}) {
  const [open, setOpen] = useState(false);
  const stt = MOCK_STT ? "STT 목업" : sttStatus() === "supported" ? "STT 지원됨" : sttStatus() === "denied" ? "STT 거부됨" : "STT 미지원";
  const tts = voiceEngine.status();

  const engineColor = last?._meta.engine === "api" ? "#5FB794" : "#E0A32A";

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[70] flex justify-start px-3 pb-safe">
        <div className="mb-[62px] flex flex-wrap gap-1.5 text-[10px] font-bold text-white">
          <span className="rounded-full px-2 py-[3px]" style={{ background: "#8A7A5F" }}>
            {stt}
          </span>
          <span className="rounded-full px-2 py-[3px]" style={{ background: tts.hasKorean ? "#5FB794" : "#E0A32A" }}>
            TTS {voiceEngine.supported ? `${tts.voices}음성${tts.hasKorean ? "·한국어" : "·한국어없음"}` : "X"}
          </span>
          {last ? (
            <span className="rounded-full px-2 py-[3px]" style={{ background: engineColor }}>
              {last._meta.engine} · {last._meta.latencyMs}ms
            </span>
          ) : null}
          <button
            onClick={() => setOpen((v) => !v)}
            className="pointer-events-auto rounded-full bg-ink/70 px-2 py-[3px]"
          >
            {open ? "접기 ▴" : "자세히 ▾"}
          </button>
        </div>
      </div>

      <button
        onClick={onSkip}
        className="absolute bottom-4 left-3 z-[70] rounded-full bg-ink/35 px-3 py-2 text-[12px] font-bold text-white backdrop-blur-sm"
        aria-label="다음 씬으로 건너뛰기"
      >
        ▶︎ 다음
      </button>

      {open ? (
        <div className="absolute inset-x-2 bottom-[104px] z-[75] max-h-[46%] overflow-y-auto rounded-2xl bg-ink/92 p-3 text-[11px] leading-snug text-cream">
          <div className="mb-2 flex gap-1.5">
            {(["auto", "api", "rule"] as EngineChoice[]).map((e) => (
              <button
                key={e}
                onClick={() => setEngine(e)}
                className="rounded-full px-2.5 py-1 font-bold"
                style={{ background: engine === e ? "#FF8B5E" : "rgba(255,255,255,.18)" }}
              >
                {e}
              </button>
            ))}
          </div>
          {last ? (
            <>
              <p className="mb-1 text-[#FFD98A]">
                engine={last._meta.engine} · {last._meta.latencyMs}ms
                {last._meta.fallbackReason ? ` · 폴백: ${last._meta.fallbackReason}` : ""}
              </p>
              <pre className="whitespace-pre-wrap break-all font-mono text-[10.5px]">
                {JSON.stringify({ coach: last.coach, npc: last.npc, narratorHint: last.narratorHint, missionCleared: last.missionCleared }, null, 1)}
              </pre>
            </>
          ) : (
            <p className="opacity-70">아직 턴 없음</p>
          )}
        </div>
      ) : null}
    </>
  );
}
