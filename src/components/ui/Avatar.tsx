"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { avatarUrl, bgOf, faceUrl, type Look } from "@/lib/data/catalog";
import { useApp } from "@/lib/store";

/** 이미지가 안 뜰 때 대신 그리는 얼굴. 깨진 이미지 아이콘을 아이에게 보여주지 않는다. */
function FallbackFace({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <circle cx="32" cy="32" r="30" fill="#FFE9CF" />
      <circle cx="22" cy="28" r="3.2" fill="#3A3226" />
      <circle cx="42" cy="28" r="3.2" fill="#3A3226" />
      <circle cx="18" cy="38" r="4" fill="#FFB2A0" opacity="0.65" />
      <circle cx="46" cy="38" r="4" fill="#FFB2A0" opacity="0.65" />
      <path d="M25 40c3.4 3.2 8.6 3.2 12 0" stroke="#3A3226" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function Frame({
  size,
  speaking,
  ring,
  bg,
  className = "",
  onClick,
  children,
}: {
  size: number;
  speaking?: boolean;
  ring?: string;
  bg: string;
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className={`relative shrink-0 overflow-hidden rounded-full ${onClick ? "tappable" : ""} ${className}`}
      style={{
        width: size,
        height: size,
        background: bg,
        boxShadow: ring
          ? `0 0 0 3px ${ring}, 0 6px 14px -4px rgba(58,50,38,.4)`
          : "0 0 0 3px rgba(255,255,255,.9), 0 6px 14px -5px rgba(58,50,38,.35)",
      }}
      animate={speaking ? { y: [0, -3.5, 0], rotate: [0, -1.6, 1.6, 0] } : { y: 0, rotate: 0 }}
      transition={speaking ? { duration: 0.85, repeat: Infinity, ease: "easeInOut" } : { type: "spring", stiffness: 300, damping: 20 }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      {children}
    </motion.div>
  );
}

/** 하늘이·준서·선생님 */
export function NpcAvatar({
  id,
  size = 56,
  speaking,
  ring,
  tint = "#FFE9CF",
  className = "",
  onClick,
}: {
  id: string;
  size?: number;
  speaking?: boolean;
  ring?: string;
  tint?: string;
  className?: string;
  onClick?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <Frame size={size} speaking={speaking} ring={ring} bg={tint} className={className} onClick={onClick}>
      {failed ? (
        <FallbackFace size={size} />
      ) : (
        <img
          src={avatarUrl(id)}
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover drag-none"
        />
      )}
    </Frame>
  );
}

/** 아이가 만든 캐릭터 */
export function MyAvatar({
  look,
  size = 56,
  speaking,
  ring,
  className = "",
  onClick,
}: {
  look?: Look;
  size?: number;
  speaking?: boolean;
  ring?: string;
  className?: string;
  onClick?: () => void;
}) {
  const stored = useApp((s) => s.look);
  const l = look ?? stored;
  const c = bgOf(l.bg);
  const [failed, setFailed] = useState(false);

  return (
    <Frame
      size={size}
      speaking={speaking}
      ring={ring}
      bg={`linear-gradient(160deg, ${c.from}, ${c.to})`}
      className={className}
      onClick={onClick}
    >
      {failed ? (
        <FallbackFace size={size} />
      ) : (
        <img
          src={faceUrl(l.face)}
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover drag-none"
        />
      )}
      <Accessory id={l.acc} />
    </Frame>
  );
}

function Accessory({ id }: { id: string }) {
  if (id === "none") return null;
  const common = "pointer-events-none absolute inset-0";
  if (id === "cap") {
    return (
      <svg className={common} viewBox="0 0 100 100" aria-hidden>
        <path d="M18 36c4-16 18-24 32-24s28 8 32 24z" fill="#FF8B5E" />
        <rect x="14" y="34" width="72" height="8" rx="4" fill="#D95F2F" />
      </svg>
    );
  }
  if (id === "ribbon") {
    return (
      <svg className={common} viewBox="0 0 100 100" aria-hidden>
        <path d="M50 22 32 12v20z" fill="#FFB8CB" />
        <path d="M50 22 68 12v20z" fill="#FFB8CB" />
        <circle cx="50" cy="22" r="6" fill="#FF8FAE" />
      </svg>
    );
  }
  if (id === "glasses") {
    return (
      <svg className={common} viewBox="0 0 100 100" aria-hidden>
        <circle cx="34" cy="48" r="13" fill="none" stroke="#3A3226" strokeWidth="3.2" />
        <circle cx="66" cy="48" r="13" fill="none" stroke="#3A3226" strokeWidth="3.2" />
        <path d="M47 48h6" stroke="#3A3226" strokeWidth="3.2" />
      </svg>
    );
  }
  return (
    <svg className={common} viewBox="0 0 100 100" aria-hidden>
      <g transform="translate(70 22)">
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx="0" cy="-7" rx="4.5" ry="7" fill="#FFD1E0" transform={`rotate(${a})`} />
        ))}
        <circle cx="0" cy="0" r="4" fill="#FFDE86" />
      </g>
    </svg>
  );
}
