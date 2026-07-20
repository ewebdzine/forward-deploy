import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireApiToken, resolveApiAuthor } from "@/lib/api-auth";
import { notifyPlanEvent } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * POST /api/plans/:id/messages { body, authorEmail? } - a reply from the dev
 * team via the review-plans skill. authorEmail attributes it to an invited
 * user when it matches; otherwise the CLI system user.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireApiToken(req);
  if (denied) return denied;

  const { id } = await params;
  let payload: { body?: string; authorEmail?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const message = (payload.body ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const plan = await db.query.plans.findFirst({
    where: eq(schema.plans.id, id),
  });
  if (!plan) return NextResponse.json({ error: "Unknown plan" }, { status: 404 });

  const author = await resolveApiAuthor(payload.authorEmail);
  const [created] = await db
    .insert(schema.planMessages)
    .values({ planId: id, authorId: author.id, body: message })
    .returning();
  await db
    .update(schema.plans)
    .set({ updatedAt: new Date() })
    .where(eq(schema.plans.id, id));
  await notifyPlanEvent({
    planId: id,
    planTitle: plan.title,
    actorId: author.id,
    actorName: author.name ?? author.email,
    event: "replied in the review thread",
    preview: message,
  });

  return NextResponse.json({
    ok: true,
    message: {
      id: created.id,
      author: author.name ?? author.email,
      at: created.createdAt.toISOString(),
    },
  });
}
