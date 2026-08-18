import type { Config } from "tailwindcss";

/**
 * v1 프로토타입의 팔레트를 그대로 옮겼다.
 * 빨간색 계열은 의도적으로 토큰에 넣지 않는다 — 아이에게 실패를 보여주지 않기 위함.
 */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      /**
       * 기본 opacity 스케일은 5단위라 bg-ink/78 같은 클래스가 아예 생성되지 않는다.
       * (배경이 통째로 사라져 내레이터 배너 글자가 안 보였다.)
       * JIT는 실제로 쓰인 클래스만 뽑으므로 1단위로 열어둬도 번들은 안 커진다.
       */
      opacity: Object.fromEntries(Array.from({ length: 101 }, (_, i) => [String(i), String(i / 100)])),
      colors: {
        cream: "#FFF8ED",
        ink: { DEFAULT: "#3A3226", soft: "#8A7A5F" },
        accent: { DEFAULT: "#FF8B5E", deep: "#D95F2F" },
        sky: "#A8D8EA",
        mint: "#7FD1AE",
        board: "#3E6B52",
      },
      fontFamily: {
        round: ["Jua", "Gaegu", "Pretendard Variable", "Pretendard", "system-ui", "sans-serif"],
        body: ["Pretendard Variable", "Pretendard", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
