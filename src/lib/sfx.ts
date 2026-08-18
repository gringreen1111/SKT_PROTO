"use client";

/**
 * 효과음. 오디오 파일 없이 WebAudio 로 만든다 — 번들에 에셋을 더하지 않기 위함.
 * 실패해도 조용히 넘어간다. 소리 때문에 진행이 막히면 안 된다.
 */

export type Sfx = "tap" | "page" | "correct" | "star" | "chime" | "pop";

let ctx: AudioContext | null = null;
let enabled = true;

export function setSfxEnabled(v: boolean) {
  enabled = v;
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  try {
    const Ctor = (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

const NOTES: Record<Sfx, { freq: number[]; dur: number; type: OscillatorType; gain: number }> = {
  tap: { freq: [660], dur: 0.07, type: "sine", gain: 0.1 },
  page: { freq: [520, 780], dur: 0.1, type: "triangle", gain: 0.09 },
  pop: { freq: [880], dur: 0.06, type: "sine", gain: 0.11 },
  correct: { freq: [660, 880], dur: 0.13, type: "sine", gain: 0.13 },
  star: { freq: [784, 988, 1319], dur: 0.15, type: "sine", gain: 0.13 },
  chime: { freq: [523, 659, 784, 1047], dur: 0.17, type: "sine", gain: 0.12 },
};

export function playSfx(name: Sfx): void {
  if (!enabled) return;
  const ac = audio();
  if (!ac) return;
  try {
    if (ac.state === "suspended") void ac.resume();
    const spec = NOTES[name];
    spec.freq.forEach((f, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      const start = ac.currentTime + i * spec.dur * 0.72;
      osc.type = spec.type;
      osc.frequency.setValueAtTime(f, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(spec.gain, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + spec.dur);
      osc.connect(gain).connect(ac.destination);
      osc.start(start);
      osc.stop(start + spec.dur + 0.02);
    });
  } catch {
    /* 무시 */
  }
}
