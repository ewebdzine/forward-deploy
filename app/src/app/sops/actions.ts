"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canAccessDepartment, findDepartment } from "@/lib/access";
import { getSourceControl, sopPath } from "@/lib/source-control";

export type CommitSopResult =
  | { ok: true; sha: string; path: string }
  | { ok: false; error: string };

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function commitSop(
  departmentSlug: string,
  topicSlug: string,
  content: string
): Promise<CommitSopResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in" };

  const department = await findDepartment(departmentSlug);
  if (!department) return { ok: false, error: "Unknown department" };
  if (!(await canAccessDepartment(session, department.id))) {
    return { ok: false, error: "You don't have access to this department" };
  }
  if (!SLUG_RE.test(topicSlug)) {
    return { ok: false, error: "Topic slug must be kebab-case (a-z, 0-9, dashes)" };
  }
  if (!content.trim()) return { ok: false, error: "The draft is empty" };

  const path = `${sopPath()}/${department.slug}/${topicSlug}.md`;
  try {
    const sha = await getSourceControl().commitFile(
      path,
      content,
      `SOP: ${department.name} / ${topicSlug} (via Forward Deploy, by ${
        session.user.name ?? session.user.email
      })`
    );
    revalidatePath("/sops");
    revalidatePath(`/sops/${department.slug}`);
    return { ok: true, sha, path };
  } catch (e) {
    return { ok: false, error: `Commit failed: ${(e as Error).message}` };
  }
}
