import { NextResponse } from "next/server";
import { getScenario } from "@/lib/scenario";

/** §6.1 GET /api/scenario/[id] — 프론트는 씬 구조를 이걸로 그린다. */
export const runtime = "nodejs";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const scenario = getScenario(id);
  if (!scenario) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(scenario);
}
