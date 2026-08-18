import type { I18n, LangCode, ScenarioMission, SpeakerId } from "@/lib/types";

/** v1의 캐릭터 생성 옵션·시간표·뱃지 테이블을 그대로 옮겼다. */

export interface Look {
  face: string;
  bg: string;
  acc: string;
}

export const FACES = Array.from({ length: 12 }, (_, i) => `f${String(i + 1).padStart(2, "0")}`);

export const BG_COLORS = [
  { id: "peach", name: "복숭아", from: "#FFE3C2", to: "#FFC49A" },
  { id: "sky", name: "하늘", from: "#D3EEF9", to: "#A8D8EA" },
  { id: "mint", name: "민트", from: "#D8F6E8", to: "#9BE0BE" },
  { id: "lemon", name: "레몬", from: "#FFF3C4", to: "#FFDE86" },
  { id: "grape", name: "포도", from: "#EADCFF", to: "#C7B4E4" },
  { id: "rose", name: "장미", from: "#FFE0E8", to: "#FFB8CB" },
  { id: "leaf", name: "풀잎", from: "#E4F3C9", to: "#BEE08E" },
  { id: "cloud", name: "구름", from: "#FFFFFF", to: "#E4E9EE" },
] as const;

export const ACCESSORIES = [
  { id: "none", name: "없음" },
  { id: "cap", name: "모자" },
  { id: "ribbon", name: "리본" },
  { id: "glasses", name: "안경" },
  { id: "flower", name: "꽃" },
] as const;

export const DEFAULT_LOOK: Look = { face: "f01", bg: "peach", acc: "none" };

export const NAME_SUGGESTIONS = ["하루", "민이", "아리", "토토", "루루", "별이", "초코", "콩이"];

export function bgOf(id: string) {
  return BG_COLORS.find((c) => c.id === id) ?? BG_COLORS[0];
}

export function randomLook(): Look {
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
  return { face: pick(FACES), bg: pick(BG_COLORS).id, acc: pick(ACCESSORIES).id };
}

/* ── 가정언어 ── */

export const LANGUAGES: { code: LangCode; label: string; native: string; flagChar: string }[] = [
  { code: "vi", label: "베트남어", native: "Tiếng Việt", flagChar: "🇻🇳" },
  { code: "zh", label: "중국어", native: "中文", flagChar: "🇨🇳" },
  { code: "ru", label: "러시아어", native: "Русский", flagChar: "🇷🇺" },
  { code: "tl", label: "필리핀어", native: "Filipino", flagChar: "🇵🇭" },
  { code: "ko", label: "한국어만", native: "한국어", flagChar: "🇰🇷" },
];

/* ── 등장인물 ── */

export const CHARACTERS: Record<SpeakerId, { id: SpeakerId; name: string; tint: string; color: string }> = {
  haneul: { id: "haneul", name: "하늘이", tint: "#C0E8F9", color: "#4A9FD9" },
  junseo: { id: "junseo", name: "준서", tint: "#D1F4E0", color: "#5FB794" },
  teacher: { id: "teacher", name: "선생님", tint: "#EADCFF", color: "#7A5CB0" },
};

/* ── 교실: 시계 · 시간표 · 사물함 ── */

export const SUBJECTS: Record<string, { key: string; iconChar: string; color: string; colorDark: string }> = {
  국어: { key: "국어", iconChar: "📖", color: "#E8604C", colorDark: "#C34733" },
  수학: { key: "수학", iconChar: "➗", color: "#4A90D9", colorDark: "#356FB0" },
  통합교과: { key: "통합교과", iconChar: "🎨", color: "#9B7BD4", colorDark: "#7A5CB0" },
  체육: { key: "체육", iconChar: "⚽", color: "#F2A93B", colorDark: "#CE8722" },
  과학: { key: "과학", iconChar: "🔬", color: "#55B98A", colorDark: "#3E9770" },
  사회: { key: "사회", iconChar: "🌏", color: "#E0885E", colorDark: "#BC6A44" },
  음악: { key: "음악", iconChar: "🎵", color: "#E36FA0", colorDark: "#BE5081" },
};

export const TIMETABLE = [
  { no: 1, label: "1교시", time: "9:00", subject: "국어" },
  { no: 2, label: "2교시", time: "10:00", subject: "수학" },
  { no: 3, label: "3교시", time: "11:00", subject: "통합교과" },
  { no: 4, label: "4교시", time: "12:00", subject: "체육" },
];

export const LOCKER_BOOKS = ["수학", "국어", "과학", "음악", "사회", "체육"];
export const CORRECT_BOOK = "국어";
export const CLOCK_TIME = { h: 8, m: 40 };
export const TODAY_LABEL = "8월 12일 화요일";

export const SUBJECT_HINT: Record<string, Partial<I18n>> = {
  국어: { ko: "한국말을 배우는 시간이야", vi: "Tiếng Hàn (Quốc ngữ)", zh: "国语（韩语课）", ru: "Корейский язык", tl: "Wikang Korean" },
  수학: { ko: "숫자와 계산을 배우는 시간이야", vi: "Toán", zh: "数学", ru: "Математика", tl: "Matematika" },
  통합교과: { ko: "만들고 그리고 함께 하는 시간이야", vi: "Môn tích hợp", zh: "综合课（美术·生活）", ru: "Интегрированный урок", tl: "Integrated na asignatura" },
  체육: { ko: "몸으로 움직이는 시간이야", vi: "Thể dục", zh: "体育", ru: "Физкультура", tl: "P.E." },
  과학: { ko: "궁금한 걸 알아보는 시간이야", vi: "Khoa học", zh: "科学", ru: "Наука", tl: "Agham" },
  사회: { ko: "우리가 사는 곳을 배우는 시간이야", vi: "Xã hội", zh: "社会", ru: "Обществознание", tl: "Araling Panlipunan" },
  음악: { ko: "노래하는 시간이야", vi: "Âm nhạc", zh: "音乐", ru: "Музыка", tl: "Musika" },
};

/* ── 보상 ── */

export const BADGES: Record<string, ScenarioMission & { iconChar: string }> = {
  timetable: { id: "timetable", label: "시간표 마스터", iconChar: "🏅", desc: "시계와 시간표를 보고 스스로 준비했어요" },
  selfsolve: { id: "selfsolve", label: "스스로 해냈어요", iconChar: "🌟", desc: "힌트 없이 혼자 힘으로 해결했어요" },
  teamwork: { id: "teamwork", label: "조별과제 참여", iconChar: "🤝", desc: "친구들과 이야기를 나눴어요" },
  firstword: { id: "firstword", label: "첫 문장 말하기", iconChar: "🗣️", desc: "내 생각을 한국어 문장으로 말했어요" },
};

export const LEVEL_THRESHOLDS = [0, 25, 60, 110, 180];
export const GROWTH_STAGES = ["씨앗", "새싹", "잎사귀", "꽃"];

export function levelOf(xp: number) {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  const base = LEVEL_THRESHOLDS[level - 1];
  const next = LEVEL_THRESHOLDS[level] ?? base + 80;
  return { level, base, next, ratio: Math.min(1, (xp - base) / (next - base)) };
}

export function growthStage(level: number): number {
  return Math.min(3, Math.max(0, level - 1));
}

export const assetUrl = (p: string) => p;
export const faceUrl = (id: string) => `/assets/faces/${id}.svg`;
export const avatarUrl = (id: string) => `/assets/avatars/${id}.svg`;
