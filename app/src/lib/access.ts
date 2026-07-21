import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth, isDeveloperRole, type Role } from "@/auth";
import { db, schema } from "@/db";
import type { Session } from "next-auth";

/** Server-side guard: require a signed-in session or bounce to /signin. */
export async function requireSession() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  return session;
}

/** Server-side guard: require one of the given roles or bounce home. */
export async function requireRole(...roles: Role[]) {
  const session = await requireSession();
  if (!roles.includes(session.user.role)) redirect("/");
  return session;
}

/**
 * May this user work on a department's SOPs/plans? Developers may on any
 * department; users only on departments they belong to.
 */
export async function canAccessDepartment(
  session: Session,
  departmentId: string
): Promise<boolean> {
  if (isDeveloperRole(session.user.role)) {
    return true;
  }
  const membership = await db.query.departmentMembers.findFirst({
    where: and(
      eq(schema.departmentMembers.userId, session.user.id),
      eq(schema.departmentMembers.departmentId, departmentId)
    ),
  });
  return Boolean(membership);
}

/** Resolve a department by slug or 404-style null. */
export async function findDepartment(slug: string) {
  return db.query.departments.findFirst({
    where: eq(schema.departments.slug, slug),
  });
}
