import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireApiToken } from "@/lib/api-auth";
import { isValidDevTransition } from "@/lib/plan-status";

export const dynamic = "force-dynamic";

/** GET /api/plans/:id - the full plan, as pull-plan lays it out. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireApiToken(req);
  if (denied) return denied;

  const { id } = await params;
  const plan = await db.query.plans.findFirst({
    where: eq(schema.plans.id, id),
    with: {
      department: true,
      author: true,
      mockups: true,
      messages: { with: { author: true } },
    },
  });
  if (!plan) return NextResponse.json({ error: "Unknown plan" }, { status: 404 });

  return NextResponse.json({
    id: plan.id,
    title: plan.title,
    department: plan.department.name,
    departmentSlug: plan.department.slug,
    author: plan.author.name ?? plan.author.email,
    authorEmail: plan.author.email,
    status: plan.status,
    sections: plan.sections,
    citations: plan.citations,
    mockups: plan.mockups.map((m) => ({
      id: m.id,
      caption: m.caption,
      html: m.html,
    })),
    thread: plan.messages
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((m) => ({
        author: m.author.name ?? m.author.email,
        role: m.author.role,
        body: m.body,
        at: m.createdAt.toISOString(),
      })),
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  });
}

/**
 * PATCH /api/plans/:id { status?, files? } - dev-side writes. `status` runs
 * the transition rules; `files` replaces the "Proposed files" section - the
 * ONE section the dev side may write (it is developer-facing by design; the
 * manager's prose sections stay theirs).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireApiToken(req);
  if (denied) return denied;

  const { id } = await params;
  let body: { status?: string; files?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!body.status && typeof body.files !== "string") {
    return NextResponse.json(
      { error: "status or files is required" },
      { status: 400 }
    );
  }

  const plan = await db.query.plans.findFirst({
    where: eq(schema.plans.id, id),
  });
  if (!plan) return NextResponse.json({ error: "Unknown plan" }, { status: 404 });

  if (body.status && !isValidDevTransition(plan.status, body.status)) {
    return NextResponse.json(
      { error: `Invalid transition: ${plan.status} -> ${body.status}` },
      { status: 409 }
    );
  }

  await db
    .update(schema.plans)
    .set({
      ...(body.status ? { status: body.status as typeof plan.status } : {}),
      ...(typeof body.files === "string"
        ? { sections: { ...plan.sections, files: body.files } }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.plans.id, id));

  return NextResponse.json({
    ok: true,
    ...(body.status ? { status: body.status } : {}),
    ...(typeof body.files === "string" ? { filesUpdated: true } : {}),
  });
}
