import type { SpeakerId } from "@/lib/types";

/**
 * §8.1 TTS.
 * ko-KR 음성이 1개뿐인 기기가 많으므로 pitch/rate 프로파일로 인물을 구분한다.
 * VoiceEngine 인터페이스로 감싸 둔다 — 나중에 서버 TTS로 갈아끼울 여지.
 */

export interface VoiceProfile {
  pitch: number;
  rate: number;
  volume?: number;
  lang?: string;
}

/** 문장 코치는 아이가 따라 읽어야 하므로 가장 느리다. */
export const VOICE: Record<SpeakerId | "coach", VoiceProfile> = {
  haneul: { pitch: 1.25, rate: 0.95 },
  junseo: { pitch: 0.95, rate: 0.85 },
  teacher: { pitch: 1.0, rate: 0.9 },
  coach: { pitch: 1.1, rate: 0.8 },
};

export interface VoiceEngine {
  speak(text: string, profile: VoiceProfile): Promise<void>;
  cancel(): void;
  readonly supported: boolean;
  status(): { voices: number; hasKorean: boolean };
}

const supported =
  typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

let preferred: SpeechSynthesisVoice | null = null;
let primed = false;

/** v1의 여성 한국어 음성 우선 선택 로직을 유지한다. */
function pickVoice(): void {
  if (!supported) return;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return;
  primed = true;
  preferred =
    voices.find((v) => v.lang === "ko-KR" && /female|여성|yuna|heami/i.test(v.name)) ??
    voices.find((v) => v.lang === "ko-KR") ??
    voices.find((v) => v.lang?.startsWith("ko")) ??
    null;
}

if (supported) {
  pickVoice();
  window.speechSynthesis.onvoiceschanged = pickVoice;
}

let current: SpeechSynthesisUtterance | null = null;

class WebSpeechVoiceEngine implements VoiceEngine {
  readonly supported = supported;

  status() {
    if (!supported) return { voices: 0, hasKorean: false };
    const voices = window.speechSynthesis.getVoices();
    return { voices: voices.length, hasKorean: voices.some((v) => v.lang?.startsWith("ko")) };
  }

  speak(text: string, profile: VoiceProfile): Promise<void> {
    return new Promise((resolve) => {
      if (!supported || !text.trim()) return resolve();

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        current = null;
        resolve();
      };

      try {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.cancel();
        }
        if (!primed) pickVoice();

        const u = new SpeechSynthesisUtterance(text);
        u.lang = profile.lang ?? "ko-KR";
        u.rate = profile.rate;
        u.pitch = profile.pitch;
        u.volume = profile.volume ?? 1;
        if (preferred && u.lang.startsWith("ko")) u.voice = preferred;

        u.onend = finish;
        u.onerror = finish;
        current = u;
        window.speechSynthesis.speak(u);
        window.speechSynthesis.resume();

        // 일부 모바일 브라우저는 onend 를 안 준다. 길이 기반 안전망.
        setTimeout(finish, Math.min(20000, 2500 + text.length * 260));
      } catch {
        finish();
      }
    });
  }

  cancel(): void {
    if (!supported) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* 무시 — 아이 화면에 에러를 띄우지 않는다. */
    }
    current = null;
  }
}

export const voiceEngine: VoiceEngine = new WebSpeechVoiceEngine();

export function speakAs(text: string, who: SpeakerId | "coach"): Promise<void> {
  return voiceEngine.speak(text, VOICE[who]);
}

export function cancelSpeech(): void {
  voiceEngine.cancel();
}

export function isSpeaking(): boolean {
  return supported && (window.speechSynthesis.speaking || current !== null);
}
