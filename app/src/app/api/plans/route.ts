import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireApiToken } from "@/lib/api-auth";
import { PLAN_STATUSES } from "@/lib/plan-status";

export const dynamic = "force-dynamic";

/** GET /api/plans?status=submitted,in_review&limit=50 - the skills' queue view. */
export async function GET(req: Request) {
  const denied = requireApiToken(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  const statuses = statusParam
    ? statusParam
        .split(",")
        .map((s) => s.trim())
        .filter((s) => (PLAN_STATUSES as readonly string[]).includes(s))
    : null;

  const plans = await db.query.plans.findMany({
    ...(statuses?.length
      ? { where: inArray(schema.plans.status, statuses as (typeof schema.plans.status.enumValues)[number][]) }
      : {}),
    with: { department: true, author: true, messages: true },
    orderBy: (p, { desc }) => desc(p.updatedAt),
    limit,
  });

  return NextResponse.json({
    plans: plans.map((p) => ({
      id: p.id,
      title: p.title,
      department: p.department.name,
      author: p.author.name ?? p.author.email,
      status: p.status,
      messages: p.messages.length,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
  });
}
