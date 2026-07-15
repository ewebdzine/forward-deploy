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

  return (
    <PlanBuilder
      planId={plan.id}
      departmentName={plan.department.name}
      initial={{
        title: plan.title,
        sections: plan.sections,
        citations: plan.citations,
        mockups: plan.mockups.map((m) => ({ id: m.id, caption: m.caption })),
      }}
    />
  );
}
