import { z } from "zod";

/**
 * §4.3 응답 스키마를 API 레벨에서 강제한다.
 * 구조화 출력을 쓰면 "JSON이 아님 / 필드 누락 / enum 오타" 부류의 폴백이 사라진다.
 * 다만 어절 수·금칙어 같은 내용 규칙은 스키마로 못 막으므로
 * validateTurnResponse(§5.5)를 그대로 통과시킨다.
 */
export const TurnSchema = z.object({
  coach: z.object({
    verdict: z.enum(["complete", "partial", "unclear"]),
    recast: z.string().nullable(),
    suggestions: z.array(z.string()).length(2),
    speakIndex: z.union([z.literal(0), z.literal(1)]).nullable(),
  }),
  npc: z.object({
    speaker: z.enum(["haneul", "junseo", "teacher"]),
    line: z.string(),
    lineI18n: z.string().nullable(),
    emotion: z.enum(["happy", "curious", "calm", "shy"]),
  }),
  narratorHint: z.string().nullable(),
  missionCleared: z.string().nullable(),
});

export type TurnSchemaShape = z.infer<typeof TurnSchema>;
