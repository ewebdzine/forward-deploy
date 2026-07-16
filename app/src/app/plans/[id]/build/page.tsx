import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
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
  // continuous (history is otherwise browser-memory only).
  const planSession = await db.query.planSessions.findFirst({
    where: eq(schema.planSessions.planId, plan.id),
  });
  const initialMessages = ((planSession?.transcript as
    | { role: string; content: string }[]
    | undefined) ?? [])
    .filter(
      (t) =>
        (t.role === "user" || t.role === "assistant") &&
        typeof t.content === "string" &&
        t.content.trim()
    )
    .slice(-24)
    .map((t) => ({ role: t.role as "user" | "assistant", content: t.content }));

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
