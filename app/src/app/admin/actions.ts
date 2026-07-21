"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { requireRole } from "@/lib/access";
import { db, schema } from "@/db";
import { buildIndexMarkdown, listSops } from "@/lib/sops";
import { getSourceControl, sopPath } from "@/lib/source-control";
import type { Role } from "@/auth";

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function createDepartment(formData: FormData) {
  await requireRole("developer", "admin");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await db
    .insert(schema.departments)
    .values({ name, slug: slugify(name) })
    .onConflictDoNothing();
  revalidatePath("/admin/departments");
}

export async function inviteUser(formData: FormData) {
  await requireRole("developer", "admin");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "user") as Role;
  const departmentId = String(formData.get("departmentId") ?? "");
  if (!email || !["user", "developer", "admin", "manager"].includes(role)) return;

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

/**
 * Offboarding: move everything one person owns to their replacement -
 * rewrites `owner:` frontmatter across their SOPs (committed to the repo,
 * INDEXes regenerated) and reassigns their plans. The SOP content itself is
 * already the handover document; this is the bookkeeping.
 */
export async function transferOwnership(formData: FormData) {
  await requireRole("developer", "admin");
  const fromId = String(formData.get("fromUserId") ?? "");
  const toId = String(formData.get("toUserId") ?? "");
  if (!fromId || !toId || fromId === toId) return;

  const [from, to] = await Promise.all([
    db.query.users.findFirst({ where: eq(schema.users.id, fromId) }),
    db.query.users.findFirst({ where: eq(schema.users.id, toId) }),
  ]);
  if (!from || !to) return;

  // Plans: reassign authorship in the database.
  await db
    .update(schema.plans)
    .set({ authorId: to.id })
    .where(eq(schema.plans.authorId, from.id));

  // Departments: give the replacement the departed person's memberships.
  const memberships = await db.query.departmentMembers.findMany({
    where: eq(schema.departmentMembers.userId, from.id),
  });
  for (const m of memberships) {
    await db
      .insert(schema.departmentMembers)
      .values({ userId: to.id, departmentId: m.departmentId })
      .onConflictDoNothing();
  }

  // SOPs: rewrite owner frontmatter across the repo, one commit per file,
  // then regenerate each touched department's INDEX.
  const provider = getSourceControl();
  const oldNames = [from.name, from.email].filter(Boolean) as string[];
  const newOwner = to.name ?? to.email;
  const departments = await db.query.departments.findMany();
  for (const dept of departments) {
    const sops = await listSops(dept.slug).catch(() => []);
    let touched = false;
    for (const sop of sops) {
      const owned = oldNames.some((n) =>
        sop.owner.toLowerCase().includes(n.toLowerCase())
      );
      if (!owned) continue;
      const updated = sop.content.replace(/^owner:.*$/m, `owner: ${newOwner}`);
      if (updated === sop.content) continue;
      await provider.commitFile(
        sop.path,
        updated,
        `Transfer SOP ownership: ${from.name ?? from.email} -> ${newOwner} (offboarding, via Forward Deploy)`
      );
      sop.owner = newOwner;
      sop.content = updated;
      touched = true;
    }
    if (touched) {
      await provider
        .commitFile(
          `${sopPath()}/${dept.slug}/INDEX.md`,
          buildIndexMarkdown(dept.name, sops),
          `SOP index: ${dept.name} (ownership transfer)`
        )
        .catch(() => {});
    }
  }

  revalidatePath("/admin/users");
  revalidatePath("/sops");
}

/**
 * Assign (or clear) a department's developer. With exactly one developer in
 * the company, assignment is unnecessary - they're the effective developer
 * everywhere automatically.
 */
export async function setDepartmentDeveloper(formData: FormData) {
  await requireRole("developer", "admin");
  const departmentId = String(formData.get("departmentId") ?? "");
  const developerId = String(formData.get("developerId") ?? "");
  if (!departmentId) return;
  await db
    .update(schema.departments)
    .set({ developerId: developerId || null })
    .where(eq(schema.departments.id, departmentId));
  revalidatePath("/admin/departments");
}

export async function toggleMembership(formData: FormData) {
  await requireRole("developer", "admin");
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
