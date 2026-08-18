"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_LOOK, type Look } from "@/lib/data/catalog";
import type { LangCode } from "@/lib/types";

/**
 * §6.3 저장 — 서버 저장 없음. localStorage 에만 둔다.
 * v1은 새로고침 시 초기화됐는데, 유저 테스트 중 아이가 실수로 새로고침하면
 * 처음부터 다시 해야 하므로 이번엔 저장한다.
 * 개인정보는 이름 한 개뿐이고 서버로 보내지 않는다(프롬프트 호칭용으로만 쓴다).
 */

export type SceneKey = "intro" | "classroom" | "groupwork" | "sentence" | "reward";
export const SCENE_ORDER: SceneKey[] = ["intro", "classroom", "groupwork", "sentence", "reward"];

interface AppState {
  scene: SceneKey;
  look: Look;
  name: string;
  lang: LangCode;
  coins: number;
  xp: number;
  badges: string[];
  hintsUsed: number;
  /** 마무리 화면의 "오늘 내가 한 말". */
  myLine: string;
  soundOn: boolean;
  bgmOn: boolean;
  started: boolean;
  /** 세션마다 새로 굴리는 시나리오 변수(하늘이 책 등). */
  sessionVars: Record<string, string>;

  setScene: (s: SceneKey) => void;
  nextScene: () => void;
  setLook: (l: Partial<Look>) => void;
  setName: (n: string) => void;
  setLang: (l: LangCode) => void;
  addCoins: (n: number) => void;
  addXp: (n: number) => void;
  addBadge: (id: string) => void;
  useHint: () => void;
  setMyLine: (s: string) => void;
  setSessionVars: (v: Record<string, string>) => void;
  toggleSound: () => void;
  toggleBgm: () => void;
  markStarted: () => void;
  reset: () => void;
}

const initial = {
  scene: "intro" as SceneKey,
  look: DEFAULT_LOOK,
  name: "",
  lang: "vi" as LangCode,
  coins: 0,
  xp: 0,
  badges: [] as string[],
  hintsUsed: 0,
  myLine: "",
  soundOn: true,
  bgmOn: false,
  started: false,
  sessionVars: {} as Record<string, string>,
};

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      ...initial,

      setScene: (scene) => set({ scene }),
      nextScene: () => {
        const i = SCENE_ORDER.indexOf(get().scene);
        set({ scene: SCENE_ORDER[Math.min(SCENE_ORDER.length - 1, i + 1)] });
      },
      setLook: (l) => set((s) => ({ look: { ...s.look, ...l } })),
      setName: (n) => set({ name: n.slice(0, 8) }),
      setLang: (lang) => set({ lang }),
      addCoins: (n) => set((s) => ({ coins: Math.max(0, s.coins + n) })),
      addXp: (n) => set((s) => ({ xp: Math.max(0, s.xp + n) })),
      addBadge: (id) => set((s) => (s.badges.includes(id) ? s : { badges: [...s.badges, id] })),
      useHint: () => set((s) => ({ hintsUsed: s.hintsUsed + 1 })),
      setMyLine: (myLine) => set({ myLine }),
      setSessionVars: (sessionVars) => set({ sessionVars }),
      toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
      toggleBgm: () => set((s) => ({ bgmOn: !s.bgmOn })),
      markStarted: () => set({ started: true }),
      reset: () => set({ ...initial, started: true }),
    }),
    {
      name: "dagagam-v2",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // 사운드 토글은 기기 설정에 가까우므로 같이 저장한다.
      partialize: (s) => ({
        scene: s.scene,
        look: s.look,
        name: s.name,
        lang: s.lang,
        coins: s.coins,
        xp: s.xp,
        badges: s.badges,
        hintsUsed: s.hintsUsed,
        myLine: s.myLine,
        soundOn: s.soundOn,
        bgmOn: s.bgmOn,
        started: s.started,
        sessionVars: s.sessionVars,
      }),
    },
  ),
);

/** 저장된 상태를 통째로 지운다. "처음부터 다시" 버튼용. */
export function clearSaved(): void {
  try {
    localStorage.removeItem("dagagam-v2");
    localStorage.removeItem("dagagam-v1");
  } catch {
    /* 무시 */
  }
}
