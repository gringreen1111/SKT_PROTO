import type { I18n, LangCode } from "@/lib/types";

/**
 * v1 프로토타입의 키워드 사전을 그대로 이식했다.
 * §3 "절대 삭제 금지" — LLM 실패·타임아웃 시 폴백 경로다.
 */

export type Reason = "fun" | "amazing" | "scary" | "sad" | "warm" | "pretty";

export interface NounEntry {
  word: string;
  kind: "noun";
  forms: string[];
  tr: I18n;
  reason: Reason;
  emoji: string;
}

export interface AdjEntry {
  word: string;
  kind: "adj";
  forms: string[];
  tr: I18n;
  reason: Reason;
  /** 이 감정어와 짝지어 떠올릴 명사. */
  pair: string;
}

export type LexEntry = NounEntry | AdjEntry;

/** reason → "그래서 ~했어" 꼬리 문장. */
export const REASON_TAIL: Record<Reason, I18n> = {
  fun: { ko: "재미있었어", vi: "nên rất thú vị", zh: "所以很有趣", ru: "и это было весело", tl: "kaya nakakatuwa" },
  amazing: { ko: "신기했어", vi: "nên thấy rất kỳ diệu", zh: "所以觉得很神奇", ru: "и это было удивительно", tl: "kaya nakamamangha" },
  scary: { ko: "조금 무서웠어", vi: "nên hơi sợ một chút", zh: "所以有点可怕", ru: "и было немного страшно", tl: "kaya medyo nakakatakot" },
  sad: { ko: "조금 슬펐어", vi: "nên hơi buồn", zh: "所以有点难过", ru: "и было немного грустно", tl: "kaya medyo malungkot" },
  warm: { ko: "마음이 따뜻해졌어", vi: "nên thấy ấm lòng", zh: "所以心里暖暖的", ru: "и стало тепло на душе", tl: "kaya uminit ang puso ko" },
  pretty: { ko: "그림이 예뻤어", vi: "và tranh rất đẹp", zh: "而且图画很漂亮", ru: "и картинки красивые", tl: "at maganda ang mga guhit" },
};

const noun = (word: string, forms: string[], reason: Reason, tr: I18n, emoji: string): NounEntry => ({
  word,
  kind: "noun",
  forms: [word, ...forms],
  tr,
  reason,
  emoji,
});

const adj = (word: string, forms: string[], pair: string, tr: I18n): AdjEntry => ({
  word,
  kind: "adj",
  forms: [word, ...forms],
  tr,
  reason: "fun",
  pair,
});

export const LEXICON: LexEntry[] = [
  noun("공룡", ["공룡이", "티라노"], "amazing", { ko: "공룡", vi: "khủng long", zh: "恐龙", ru: "динозавр", tl: "dinosaur" }, "🦕"),
  noun("강아지", ["개", "멍멍이", "강아지가"], "warm", { ko: "강아지", vi: "chú chó", zh: "小狗", ru: "щенок", tl: "tuta" }, "🐶"),
  noun("고양이", ["야옹이", "고양이가"], "warm", { ko: "고양이", vi: "mèo con", zh: "小猫", ru: "котёнок", tl: "kuting" }, "🐱"),
  noun("토끼", ["토끼가"], "warm", { ko: "토끼", vi: "con thỏ", zh: "兔子", ru: "кролик", tl: "kuneho" }, "🐰"),
  noun("로봇", ["로보트", "로봇이"], "amazing", { ko: "로봇", vi: "người máy", zh: "机器人", ru: "робот", tl: "robot" }, "🤖"),
  noun("우주", ["우주선", "별나라"], "amazing", { ko: "우주", vi: "vũ trụ", zh: "宇宙", ru: "космос", tl: "kalawakan" }, "🚀"),
  noun("마법", ["마술", "마법사"], "amazing", { ko: "마법", vi: "phép thuật", zh: "魔法", ru: "магия", tl: "mahika" }, "✨"),
  noun("공주", ["공주님"], "pretty", { ko: "공주", vi: "công chúa", zh: "公主", ru: "принцесса", tl: "prinsesa" }, "👑"),
  noun("왕자", ["왕자님"], "fun", { ko: "왕자", vi: "hoàng tử", zh: "王子", ru: "принц", tl: "prinsipe" }, "🤴"),
  noun("바다", ["바다가", "물고기"], "pretty", { ko: "바다", vi: "biển", zh: "大海", ru: "море", tl: "dagat" }, "🌊"),
  noun("숲", ["숲속", "나무"], "pretty", { ko: "숲", vi: "khu rừng", zh: "森林", ru: "лес", tl: "gubat" }, "🌳"),
  noun("별", ["별님", "별들"], "pretty", { ko: "별", vi: "ngôi sao", zh: "星星", ru: "звезда", tl: "bituin" }, "⭐"),
  noun("무지개", ["무지게"], "pretty", { ko: "무지개", vi: "cầu vồng", zh: "彩虹", ru: "радуга", tl: "bahaghari" }, "🌈"),
  noun("꽃", ["꽃이", "민들레"], "pretty", { ko: "꽃", vi: "bông hoa", zh: "花", ru: "цветок", tl: "bulaklak" }, "🌸"),
  noun("눈사람", ["눈", "겨울"], "fun", { ko: "눈사람", vi: "người tuyết", zh: "雪人", ru: "снеговик", tl: "snowman" }, "⛄"),
  noun("친구", ["친구들", "친구가"], "warm", { ko: "친구", vi: "bạn bè", zh: "朋友", ru: "друзья", tl: "kaibigan" }, "🤝"),
  noun("가족", ["엄마", "아빠", "동생"], "warm", { ko: "가족", vi: "gia đình", zh: "家人", ru: "семья", tl: "pamilya" }, "👨‍👩‍👧"),
  noun("학교", ["교실", "선생님"], "fun", { ko: "학교", vi: "trường học", zh: "学校", ru: "школа", tl: "paaralan" }, "🏫"),
  noun("빵", ["구름빵", "케이크"], "fun", { ko: "빵", vi: "bánh mì", zh: "面包", ru: "хлеб", tl: "tinapay" }, "🍞"),
  noun("요리", ["음식", "먹는"], "fun", { ko: "요리", vi: "nấu ăn", zh: "料理", ru: "готовка", tl: "pagluluto" }, "🍳"),
  noun("축구", ["공", "축구공", "운동"], "fun", { ko: "축구", vi: "bóng đá", zh: "足球", ru: "футбол", tl: "football" }, "⚽"),
  noun("자동차", ["차", "기차", "버스"], "fun", { ko: "자동차", vi: "ô tô", zh: "汽车", ru: "машина", tl: "sasakyan" }, "🚗"),
  noun("그림책", ["그림", "그림책이"], "pretty", { ko: "그림책", vi: "sách tranh", zh: "绘本", ru: "книжка с картинками", tl: "picture book" }, "📗"),
  noun("만화", ["만화책", "웹툰"], "fun", { ko: "만화", vi: "truyện tranh", zh: "漫画", ru: "комикс", tl: "komiks" }, "📚"),
  noun("괴물", ["귀신", "유령"], "scary", { ko: "괴물", vi: "quái vật", zh: "怪物", ru: "монстр", tl: "halimaw" }, "👾"),
  // 감정어는 어간까지 넣는다. 아이는 "재밌었어"처럼 과거형으로 말하는데
  // v1은 활용형만 갖고 있어 "재밌었어"가 사전에 안 잡혔다.
  adj("재미있다", ["재밌다", "재밌어", "재미있어", "재밌는", "재밌", "재미있"], "만화", { ko: "재미있다", vi: "thú vị", zh: "有趣", ru: "весело", tl: "masaya" }),
  adj("무섭다", ["무서워", "무서운", "무서", "무섭"], "괴물", { ko: "무섭다", vi: "đáng sợ", zh: "可怕", ru: "страшно", tl: "nakakatakot" }),
  adj("슬프다", ["슬퍼", "슬픈", "슬펐어", "슬펐", "슬프"], "강아지", { ko: "슬프다", vi: "buồn", zh: "难过", ru: "грустно", tl: "malungkot" }),
  adj("신기하다", ["신기해", "신기한", "신기했어", "신기했", "신기"], "우주", { ko: "신기하다", vi: "kỳ diệu", zh: "神奇", ru: "удивительно", tl: "nakamamangha" }),
  adj("예쁘다", ["예뻐", "예쁜", "이쁘다", "이뻐", "예뻤", "이뻤", "예쁘", "이쁘"], "그림책", { ko: "예쁘다", vi: "đẹp", zh: "漂亮", ru: "красиво", tl: "maganda" }),
];

export interface SuggestionLine {
  ko: string;
  emoji: string;
  tr: I18n;
}

/** 키워드를 못 잡았을 때 쓰는 기본 추천 문장. */
export const FALLBACK_LINES: SuggestionLine[] = [
  {
    ko: "제목이 잘 기억 안 나.",
    emoji: "🤔",
    tr: { ko: "책 제목이 생각나지 않아.", vi: "Mình không nhớ rõ tên sách.", zh: "书名我记不太清了。", ru: "Я не помню название.", tl: "Hindi ko maalala ang pamagat." },
  },
  {
    ko: "그림이 예쁜 책이었어.",
    emoji: "🎨",
    tr: { ko: "그림이 예쁜 책이었어.", vi: "Đó là cuốn sách có tranh rất đẹp.", zh: "那是一本图画很漂亮的书。", ru: "Это была книга с красивыми картинками.", tl: "Isa itong aklat na maganda ang mga guhit." },
  },
  {
    ko: "조금만 생각해 볼게.",
    emoji: "⏳",
    tr: { ko: "조금만 더 생각해 볼게.", vi: "Cho mình suy nghĩ một chút nhé.", zh: "让我再想一下。", ru: "Дай мне немного подумать.", tl: "Pag-iisipan ko muna sandali." },
  },
];

/** 받침 유무. "공룡이" / "토끼가" 를 고르는 데 쓴다. */
export function hasBatchim(word: string): boolean {
  const t = word.trim();
  const code = t.charCodeAt(t.length - 1);
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

export function withParticle(word: string, pair: [string, string]): string {
  return word + (hasBatchim(word) ? pair[0] : pair[1]);
}

export const stripPunct = (s: string): string => s.replace(/[\s.,!?~…·'"]/g, "");

/**
 * 발화에서 사전 항목을 찾는다. 명사 우선, 그 다음 최장 일치 우선.
 *
 * 최장 일치가 필요한 이유: "개"(강아지 별칭)는 "무지개" 안에 들어 있고,
 * "공"(축구 별칭)은 "공룡" 안에 들어 있다. 짧은 별칭이 먼저 잡히면
 * 아이가 "무지개"라고 말했는데 강아지 책을 추천하게 된다.
 */
export function matchLexicon(text: string): LexEntry[] {
  const t = stripPunct(text);
  if (!t) return [];

  const hits: { entry: LexEntry; matched: number }[] = [];
  for (const e of LEXICON) {
    let longest = 0;
    for (const f of e.forms) {
      const s = stripPunct(f);
      if (s && t.includes(s)) longest = Math.max(longest, s.length);
    }
    if (longest > 0) hits.push({ entry: e, matched: longest });
  }

  hits.sort((a, b) => {
    if (a.entry.kind !== b.entry.kind) return a.entry.kind === "noun" ? -1 : 1;
    return b.matched - a.matched;
  });
  return hits.map((h) => h.entry);
}

/** 사전 항목 하나로 추천 문장 2개를 만든다. 길이가 서로 다르게. */
export function suggestionsFor(entry: LexEntry): SuggestionLine[] {
  const fallbackNoun = LEXICON.find((e): e is NounEntry => e.kind === "noun")!;
  const n: NounEntry =
    entry.kind === "noun"
      ? entry
      : (LEXICON.find((e): e is NounEntry => e.kind === "noun" && e.word === entry.pair) ?? fallbackNoun);

  const w = n.word;
  const tail = REASON_TAIL[n.reason];
  const tr = n.tr;

  return [
    {
      ko: `나는 ${w} 책을 읽었어.`,
      emoji: n.emoji,
      tr: {
        ko: `내가 읽은 건 ${w} 이야기야.`,
        vi: `Mình đã đọc cuốn sách về ${tr.vi}.`,
        zh: `我读了关于${tr.zh}的书。`,
        ru: `Я читал книгу про ${tr.ru}.`,
        tl: `Nagbasa ako ng aklat tungkol sa ${tr.tl}.`,
      },
    },
    {
      ko: `${withParticle(w, ["이", "가"])} 나와서 ${tail.ko}.`,
      emoji: n.emoji,
      tr: {
        ko: `${w}가 나와서 ${tail.ko}.`,
        vi: `Có ${tr.vi} xuất hiện ${tail.vi}.`,
        zh: `里面出现了${tr.zh}，${tail.zh}。`,
        ru: `Там был ${tr.ru}, ${tail.ru}.`,
        tl: `May ${tr.tl} doon ${tail.tl}.`,
      },
    },
  ];
}

/** L0 비계 — 단어 조합 모드 슬롯. 누가 / 무엇을 / 어떻게 */
export function wordSlots(entry: LexEntry | null): { label: string; chips: string[] }[] {
  const topic = entry ? (entry.kind === "noun" ? entry.word : entry.pair) : "그림책";
  const others = ["공룡", "강아지", "마법", "친구"].filter((w) => w !== topic).slice(0, 3);
  return [
    { label: "누가", chips: ["나는", "이 책은"] },
    { label: "무엇을", chips: [`${topic} 책을`, ...others.map((w) => `${w} 책을`)] },
    { label: "어떻게", chips: ["읽었어.", "재미있었어.", "좋았어."] },
  ];
}

/** 아이가 추천 문장을 따라 읽었는지 느슨하게 확인한다. 발음이 정확할 필요는 없다. */
export function similarity(a: string, b: string): number {
  const s = stripPunct(a);
  const t = stripPunct(b);
  if (!s || !t) return 0;
  if (s === t) return 1;
  const d: number[][] = Array.from({ length: s.length + 1 }, (_, i) =>
    Array.from({ length: t.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= s.length; i++) {
    for (let j = 1; j <= t.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1));
    }
  }
  return Math.max(0, 1 - d[s.length][t.length] / Math.max(s.length, t.length));
}

/** 조사·어미만 남은 짧은 조각. 내용어를 셀 때 뺀다. */
const FUNCTION_WORDS = new Set(["나는", "나", "내가", "이", "그", "저", "책을", "책", "이건", "그건"]);

/**
 * 아이가 추천 문장을 따라 읽었는지 본다.
 *
 * 발음이 정확할 필요는 없다(§5.3). 7~9세가 초급 한국어를 읽는 상황이고,
 * STT는 어차피 흘려 듣는다. 그래서 두 갈래로 느슨하게 본다.
 *   1) 전체 문자열이 얼추 비슷하거나
 *   2) 목표 문장의 내용어를 절반 이상 담고 있으면 통과
 */
export function matchesTarget(said: string, target: string): boolean {
  const a = stripPunct(said);
  const b = stripPunct(target);
  if (!a || !b) return false;

  if (similarity(said, target) >= 0.5) return true;

  const content = target
    .split(/\s+/)
    .map((w) => stripPunct(w))
    .filter((w) => w.length >= 2 && !FUNCTION_WORDS.has(w));
  if (!content.length) return a.includes(b) || b.includes(a);

  // 어미가 잘려도 잡히게 앞 2글자까지만 본다("읽었어요" → "읽었").
  const hit = content.filter((w) => a.includes(w) || a.includes(w.slice(0, 2))).length;
  return hit / content.length >= 0.5;
}

export type LangKey = LangCode;
