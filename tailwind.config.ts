import type { Config } from "tailwindcss";

/**
 * v1 프로토타입의 팔레트를 그대로 옮겼다.
 * 빨간색 계열은 의도적으로 토큰에 넣지 않는다 — 아이에게 실패를 보여주지 않기 위함.
 */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
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
