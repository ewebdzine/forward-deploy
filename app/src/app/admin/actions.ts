"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { requireRole } from "@/lib/access";
import { db, schema } from "@/db";
import type { Role } from "@/auth";

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function createDepartment(formData: FormData) {
  await requireRole("admin");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await db
    .insert(schema.departments)
    .values({ name, slug: slugify(name) })
    .onConflictDoNothing();
  revalidatePath("/admin/departments");
}

export async function inviteUser(formData: FormData) {
  await requireRole("admin");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "manager") as Role;
  const departmentId = String(formData.get("departmentId") ?? "");
  if (!email || !["admin", "developer", "manager"].includes(role)) return;

  // Creating the user row IS the invitation: signIn only mails magic links to
  // emails that exist here. Idempotent on re-invite.
  const [user] = await db
    .insert(schema.users)
    .values({ email, name, role })
    .onConflictDoUpdate({
      target: schema.users.email,
      set: { role, ...(name ? { name } : {}) },
    })
    .returning();

  if (departmentId) {
    await db
      .insert(schema.departmentMembers)
      .values({ userId: user.id, departmentId })
      .onConflictDoNothing();
  }
  revalidatePath("/admin/users");
}

export async function toggleMembership(formData: FormData) {
  await requireRole("admin");
  const userId = String(formData.get("userId") ?? "");
  const departmentId = String(formData.get("departmentId") ?? "");
  if (!userId || !departmentId) return;

  const existing = await db.query.departmentMembers.findFirst({
    where: and(
      eq(schema.departmentMembers.userId, userId),
      eq(schema.departmentMembers.departmentId, departmentId)
    ),
  });
  if (existing) {
    await db
      .delete(schema.departmentMembers)
      .where(
        and(
          eq(schema.departmentMembers.userId, userId),
          eq(schema.departmentMembers.departmentId, departmentId)
        )
      );
  } else {
    await db
      .insert(schema.departmentMembers)
      .values({ userId, departmentId })
      .onConflictDoNothing();
  }
  revalidatePath("/admin/users");
}
