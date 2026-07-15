"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { canAccessDepartment } from "@/lib/access";
import { missingRequiredSections } from "@/lib/plan-sections";

export async function createPlan(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const departmentId = String(formData.get("departmentId") ?? "");
  const title = String(formData.get("title") ?? "").trim() || "Untitled plan";
  if (!departmentId || !(await canAccessDepartment(session, departmentId))) {
    redirect("/plans");
  }

  const [plan] = await db
    .insert(schema.plans)
    .values({
      title,
      departmentId,
      authorId: session.user.id,
      status: "draft",
    })
    .returning();

  redirect(`/plans/${plan.id}/build`);
}

export type SubmitPlanResult = { ok: true } | { ok: false; error: string };

export async function submitPlan(planId: string): Promise<SubmitPlanResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in" };

  const plan = await db.query.plans.findFirst({
    where: eq(schema.plans.id, planId),
  });
  if (!plan) return { ok: false, error: "Unknown plan" };
  if (!(await canAccessDepartment(session, plan.departmentId))) {
    return { ok: false, error: "Forbidden" };
  }
  if (plan.status !== "draft" && plan.status !== "changes_requested") {
    return { ok: false, error: `Plan is already ${plan.status}` };
  }

  const missing = missingRequiredSections(plan.sections);
  if (missing.length) {
    return {
      ok: false,
      error: `Fill these sections before submitting: ${missing.join(", ")}`,
    };
  }

  await db
    .update(schema.plans)
    .set({ status: "submitted", updatedAt: new Date() })
    .where(eq(schema.plans.id, planId));
  revalidatePath("/plans");
  revalidatePath(`/plans/${planId}`);
  return { ok: true };
}
