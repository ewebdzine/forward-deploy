import { redirect } from "next/navigation";
import { auth, type Role } from "@/auth";

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
