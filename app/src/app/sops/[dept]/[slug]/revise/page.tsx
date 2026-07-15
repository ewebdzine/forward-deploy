import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canAccessDepartment, findDepartment, requireSession } from "@/lib/access";
import { readSop } from "@/lib/sops";
import { sopPath } from "@/lib/source-control";
import SopBuilder from "../../builder";

export const metadata = { title: "Revise SOP - Forward Deploy" };

export default async function ReviseSopPage({
  params,
}: {
  params: Promise<{ dept: string; slug: string }>;
}) {
  const session = await requireSession();
  const { dept, slug } = await params;
  const department = await findDepartment(dept);
  if (!department) notFound();
  if (!(await canAccessDepartment(session, department.id))) redirect("/sops");

  let sop;
  try {
    sop = await readSop(`${sopPath()}/${department.slug}/${slug}.md`);
  } catch {
    notFound();
  }

  return (
    <main className="wide">
      <h1>
        {department.name} - revise: {sop.topic}
      </h1>
      <p className="muted">
        <Link href={`/sops/${department.slug}/${slug}`}>&larr; back to the SOP</Link>
        {" - "}committing replaces the file in the repo (git keeps the history).
      </p>
      <SopBuilder
        departmentSlug={department.slug}
        departmentName={department.name}
        initial={{
          path: sop.path,
          slug: sop.slug,
          title: sop.topic,
          markdown: sop.content,
        }}
      />
    </main>
  );
}
