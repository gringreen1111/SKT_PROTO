/**
 * §8.2 STT. v1 설정을 그대로 유지한다.
 * lang ko-KR / interimResults true / continuous false / maxAlternatives 1 / silence 5000ms
 *
 * 미지원·권한 거부는 에러 화면을 띄우지 않는다. 호출부가 단어 조합 모드로 전환한다.
 */

export const STT_CONFIDENCE_FLOOR = 0.6;
const SILENCE_MS = 5000;

export type SttErrorKind = "unsupported" | "denied" | "no-speech" | "other";

export interface SttHandlers {
  onInterim?: (text: string) => void;
  onFinal?: (text: string, confidence: number) => void;
  onError?: (kind: SttErrorKind) => void;
  onEnd?: () => void;
  onLevel?: (level: number) => void;
  /**
   * 아이가 따라 말해야 하는 문장. 목업 STT(?demo=1)가 이 문장을 대신 읽어 준다.
   * 진짜 음성 인식에는 아무 영향이 없다 — 힌트로도 쓰지 않는다.
   */
  expect?: string | null;
}

export interface SttSession {
  stop(): void;
  abort(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string; confidence: number } }>;
}

const win = typeof window !== "undefined" ? (window as unknown as Record<string, unknown>) : undefined;
const Recognition = (win?.SpeechRecognition ?? win?.webkitSpeechRecognition) as SpeechRecognitionCtor | undefined;

const params = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
export const DEV_MODE = params.get("dev") === "1";
export const MOCK_STT = params.get("mock") === "stt" || params.get("demo") === "1";

const DEMO_SCRIPT = "재밌겠다 나도 읽어보고 싶어,준서야 잘 말했어,나는 공룡 책을 읽었어";
const mockLines = (params.get("say") ?? (params.get("demo") === "1" ? DEMO_SCRIPT : "공룡"))
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
let mockCursor = 0;
let micDenied = false;

export type SttStatus = "supported" | "denied" | "unsupported";

export function sttStatus(): SttStatus {
  if (MOCK_STT) return "supported";
  if (!Recognition) return "unsupported";
  return micDenied ? "denied" : "supported";
}

/** 마이크 입력 레벨. 말하는 동안 캐릭터가 반응하는 데 쓴다. */
async function meterMic(onLevel: (v: number) => void): Promise<() => void> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const Ctx = (win?.AudioContext ?? win?.webkitAudioContext) as typeof AudioContext;
    const ctx = new Ctx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    const buf = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      onLevel(Math.min(1, Math.sqrt(sum / buf.length) * 3.4));
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
    };
  } catch {
    return () => {};
  }
}

function fakeMeter(onLevel: (v: number) => void): () => void {
  let t = 0;
  const id = setInterval(() => {
    t += 0.12;
    onLevel(0.28 + Math.abs(Math.sin(t * 1.7)) * 0.45 + Math.random() * 0.12);
  }, 60);
  return () => clearInterval(id);
}

/** ?mock=stt — 마이크 없이 전체 플로우를 시연한다. */
function mockSession(h: SttHandlers): SttSession {
  // 따라 말하기 단계면 그 문장을 읽은 것으로 시늉한다.
  let line: string;
  if (h.expect) {
    line = h.expect;
  } else {
    line = mockLines[Math.min(mockCursor, mockLines.length - 1)];
    mockCursor += 1;
  }
  const short = line.replace(/\s/g, "").length <= 5;
  const stopMeter = fakeMeter((v) => h.onLevel?.(v));

  let ended = false;
  let shown = "";
  const timers: number[] = [];
  const at = (ms: number, fn: () => void) => {
    timers.push(window.setTimeout(() => !ended && fn(), ms));
  };
  const finish = () => {
    if (ended) return;
    ended = true;
    stopMeter();
    h.onFinal?.(line, 0.92);
    h.onEnd?.();
  };

  let t = 620;
  for (let i = 1; i <= line.length; i++) {
    t += 150 + Math.round(Math.random() * 90);
    at(t, () => {
      shown = line.slice(0, i);
      h.onInterim?.(shown);
    });
  }
  if (short) {
    t += 780;
    at(t, () => h.onInterim?.(`${shown}…`));
    t += 620;
    at(t, () => h.onInterim?.(`${shown}… 어…`));
    t += 900;
    at(t, finish);
  } else {
    t += 520;
    at(t, finish);
  }

  const clearAll = () => timers.forEach((id) => window.clearTimeout(id));
  return {
    stop() {
      clearAll();
      finish();
    },
    abort() {
      ended = true;
      clearAll();
      stopMeter();
      h.onEnd?.();
    },
  };
}

export function listen(h: SttHandlers): SttSession {
  if (MOCK_STT) return mockSession(h);

  if (!Recognition) {
    h.onError?.("unsupported");
    h.onEnd?.();
    return { stop() {}, abort() {} };
  }

  let stopMeter: (() => void) | null = null;
  let ended = false;
  let finalText = "";
  let bestConfidence = 0;
  let heardSomething = false;

  const rec = new Recognition();
  rec.lang = "ko-KR";
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  let silence = window.setTimeout(() => {
    if (!heardSomething) {
      try {
        rec.stop();
      } catch {
        /* 무시 */
      }
    }
  }, SILENCE_MS);

  const finish = () => {
    if (ended) return;
    ended = true;
    window.clearTimeout(silence);
    stopMeter?.();
    h.onEnd?.();
  };

  rec.onresult = (e) => {
    heardSomething = true;
    window.clearTimeout(silence);
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) {
        finalText += r[0].transcript;
        bestConfidence = Math.max(bestConfidence, r[0].confidence ?? 0);
      } else {
        interim += r[0].transcript;
      }
    }
    if (interim) h.onInterim?.((finalText + interim).trim());
    else if (finalText) h.onInterim?.(finalText.trim());
  };

  rec.onerror = (e) => {
    const kind = e?.error;
    if (kind === "not-allowed" || kind === "service-not-allowed") {
      micDenied = true;
      h.onError?.("denied");
    } else if (kind === "no-speech") {
      h.onError?.("no-speech");
    } else if (kind !== "aborted") {
      h.onError?.("other");
    }
  };

  rec.onend = () => {
    // confidence 를 안 주는 브라우저가 있다. 그럴 땐 텍스트가 있으면 신뢰한다.
    const conf = bestConfidence > 0 ? bestConfidence : finalText.trim() ? 0.8 : 0;
    h.onFinal?.(finalText.trim(), conf);
    finish();
  };

  try {
    rec.start();
    meterMic((v) => h.onLevel?.(v)).then((stop) => {
      if (ended) stop();
      else stopMeter = stop;
    });
  } catch {
    h.onError?.("other");
    finish();
  }

  return {
    stop() {
      try {
        rec.stop();
      } catch {
        finish();
      }
    },
    abort() {
      ended = true;
      try {
        rec.abort();
      } catch {
        /* 무시 */
      }
      window.clearTimeout(silence);
      stopMeter?.();
      h.onEnd?.();
    },
  };
}
