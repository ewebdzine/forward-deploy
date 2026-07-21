import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireApiToken, resolveApiAuthor } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/plans/:id/usage - the skills report Claude Code token usage for a
 * plan's review or build phase. These tokens ride a Claude subscription, so
 * they're logged with source=subscription and never priced: the plan's
 * lifecycle view shows the full token scope while cost stays honest.
 *
 * Body: { phase: "review"|"build", tokensIn?, tokensOut?, tokensCacheWrite?,
 *         tokensCacheRead?, authorEmail? }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireApiToken(req);
  if (denied) return denied;

  const { id } = await params;
  let payload: {
    phase?: string;
    tokensIn?: number;
    tokensOut?: number;
    tokensCacheWrite?: number;
    tokensCacheRead?: number;
    authorEmail?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const phase = payload.phase;
  if (phase !== "review" && phase !== "build") {
    return NextResponse.json(
      { error: "phase must be 'review' or 'build'" },
      { status: 400 }
    );
  }
  const n = (v: unknown) =>
    Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : 0;
  const tokens = {
    tokensIn: n(payload.tokensIn),
    tokensOut: n(payload.tokensOut),
    tokensCacheWrite: n(payload.tokensCacheWrite),
    tokensCacheRead: n(payload.tokensCacheRead),
  };
  if (Object.values(tokens).every((v) => v === 0)) {
    return NextResponse.json(
      { error: "at least one token count must be > 0" },
      { status: 400 }
    );
  }

  const plan = await db.query.plans.findFirst({
    where: eq(schema.plans.id, id),
  });
  if (!plan) return NextResponse.json({ error: "Unknown plan" }, { status: 404 });

  const author = await resolveApiAuthor(payload.authorEmail);
  await db.insert(schema.usageLog).values({
    userId: author.id,
    kind: phase,
    refId: id,
    source: "subscription",
    ...tokens,
  });

  return NextResponse.json({ ok: true, phase, logged: tokens });
}
