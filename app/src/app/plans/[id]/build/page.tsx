import { notFound, redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { requireSession, canAccessDepartment } from "@/lib/access";
import { db, schema } from "@/db";
import PlanBuilder from "./plan-builder";

export const metadata = { title: "Build plan - Forward Deploy" };

export default async function PlanBuildPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const plan = await db.query.plans.findFirst({
    where: eq(schema.plans.id, id),
    with: { department: true, mockups: true },
  });
  if (!plan) notFound();
  if (!(await canAccessDepartment(session, plan.departmentId))) {
    redirect("/plans");
  }
  if (plan.status !== "draft" && plan.status !== "changes_requested") {
    redirect(`/plans/${plan.id}`);
  }

  // Restore the conversation from the audit transcript so resuming feels
  // continuous (history is otherwise browser-memory only). Turns by someone
  // other than the viewer carry the author's name - a plan can be co-authored
  // by the manager and a developer across a changes_requested round.
  const planSession = await db.query.planSessions.findFirst({
    where: eq(schema.planSessions.planId, plan.id),
  });
  const rawTurns = ((planSession?.transcript as
    | { role: string; content: string; author?: string }[]
    | undefined) ?? [])
    .filter(
      (t) =>
        (t.role === "user" || t.role === "assistant") &&
        typeof t.content === "string" &&
        t.content.trim()
    )
    .slice(-24);

  const authorEmails = [
    ...new Set(
      rawTurns
        .map((t) => t.author)
        .filter((a): a is string => Boolean(a) && a !== session.user.email)
    ),
  ];
  const authors = authorEmails.length
    ? await db.query.users.findMany({
        where: inArray(schema.users.email, authorEmails),
      })
    : [];
  const nameByEmail = new Map(authors.map((u) => [u.email, u.name ?? u.email]));

  const initialMessages = rawTurns.map((t) => ({
    role: t.role as "user" | "assistant",
    content: t.content,
    ...(t.author && t.author !== session.user.email
      ? { author: nameByEmail.get(t.author) ?? t.author }
      : {}),
  }));

  return (
    <PlanBuilder
      planId={plan.id}
      departmentName={plan.department.name}
      initialMessages={initialMessages}
      initial={{
        title: plan.title,
        sections: plan.sections,
        citations: plan.citations,
        mockups: plan.mockups.map((m) => ({ id: m.id, caption: m.caption })),
        resolvedQuestions: plan.resolvedQuestions,
      }}
    />
  );
}
