"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { faceUrl, avatarUrl, FACES, CHARACTERS } from "@/lib/data/catalog";

/**
 * 모바일 세로 고정 320~430px 기준(§2).
 * 데스크톱에서는 폰 목업 안에 담고, 실제 모바일에서는 전체 화면을 쓴다.
 * v1의 가로모드 차단 가드를 그대로 가져왔다.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const [landscape, setLandscape] = useState(false);
  const [phone, setPhone] = useState(false);

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setPhone(w < 520);
      setLandscape(w > h && h < 520);
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  if (landscape) {
    return (
      <div className="app-shell">
        <div className="grid place-items-center gap-3 px-8 text-center">
          <motion.span animate={{ rotate: [0, -90, -90, 0] }} transition={{ duration: 2.4, repeat: Infinity }} className="text-[54px]">
            📱
          </motion.span>
          <p className="font-round text-[22px] text-ink">휴대폰을 세로로</p>
          <p className="text-[14px] text-ink-soft">세로 화면에서 더 재미있어요!</p>
        </div>
      </div>
    );
  }

  if (phone) {
    return (
      <div className="fixed inset-0 overflow-hidden bg-cream">
        <div className="relative h-full w-full overflow-hidden">{children}</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="phone-bezel">
        <div className="phone-island" />
        <div className="phone-btn" style={{ left: -2, top: 150, height: 34 }} />
        <div className="phone-btn" style={{ left: -2, top: 196, height: 58 }} />
        <div className="phone-btn" style={{ left: -2, top: 266, height: 58 }} />
        <div className="phone-btn" style={{ right: -2, top: 214, height: 84 }} />
        <div className="stage relative overflow-hidden bg-cream">{children}</div>
      </div>
    </div>
  );
}

/** §3 스플래시 — "교실을 준비하고 있어요…" */
export function Splash({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let alive = true;
    const urls = [
      ...FACES.map(faceUrl),
      avatarUrl(CHARACTERS.haneul.id),
      avatarUrl(CHARACTERS.junseo.id),
      avatarUrl(CHARACTERS.teacher.id),
    ];
    let loaded = 0;
    const bump = () => {
      loaded += 1;
      if (alive) setPct(Math.round((loaded / (urls.length + 1)) * 100));
    };

    const started = performance.now();
    const images = urls.map(
      (u) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = u;
        }).then(bump),
    );
    const fonts = (document.fonts?.ready ?? Promise.resolve()).then(bump).catch(bump);

    void Promise.all([...images, fonts]).then(async () => {
      const spent = performance.now() - started;
      if (spent < 900) await new Promise((r) => setTimeout(r, 900 - spent));
      if (!alive) return;
      setPct(100);
      setTimeout(onDone, 320);
    });

    return () => {
      alive = false;
    };
  }, [onDone]);

  return (
    <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-[#FFF3DE] to-[#FFE3C6]">
      <div className="grid place-items-center gap-3">
        <motion.span
          animate={{ y: [0, -8, 0], rotate: [0, -4, 4, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="text-[62px]"
        >
          🏫
        </motion.span>
        <p className="font-round text-[22px] text-ink">다가감</p>
        <p className="text-[13.5px] text-ink-soft">교실을 준비하고 있어요…</p>
        <div className="mt-1 h-2 w-40 overflow-hidden rounded-full bg-ink/10">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg,#FFA276,#FF8B5E)" }}
            animate={{ width: `${pct}%` }}
            transition={{ ease: "easeOut" }}
          />
        </div>
      </div>
    </div>
  );
}
