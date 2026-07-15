"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { canAccessDepartment } from "@/lib/access";
import { missingRequiredSections } from "@/lib/plan-sections";
import { isValidDevTransition } from "@/lib/plan-status";

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

export async function addPlanMessage(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;
  const planId = String(formData.get("planId") ?? "");
  const message = String(formData.get("body") ?? "").trim();
  if (!planId || !message) return;

  const plan = await db.query.plans.findFirst({
    where: eq(schema.plans.id, planId),
  });
  if (!plan || !(await canAccessDepartment(session, plan.departmentId))) return;

  await db.insert(schema.planMessages).values({
    planId,
    authorId: session.user.id,
    body: message,
  });
  await db
    .update(schema.plans)
    .set({ updatedAt: new Date() })
    .where(eq(schema.plans.id, planId));
  revalidatePath(`/plans/${planId}`);
  revalidatePath("/plans");
}

export async function setPlanStatus(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;
  // Status advances are the dev team's side of the board.
  if (session.user.role !== "developer" && session.user.role !== "admin") return;

  const planId = String(formData.get("planId") ?? "");
  const to = String(formData.get("status") ?? "");
  if (!planId || !to) return;

  const plan = await db.query.plans.findFirst({
    where: eq(schema.plans.id, planId),
  });
  if (!plan || !isValidDevTransition(plan.status, to)) return;

  await db
    .update(schema.plans)
    .set({ status: to as typeof plan.status, updatedAt: new Date() })
    .where(eq(schema.plans.id, planId));
  revalidatePath(`/plans/${planId}`);
  revalidatePath("/plans");
}
