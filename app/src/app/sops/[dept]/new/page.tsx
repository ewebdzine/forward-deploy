import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canAccessDepartment, findDepartment, requireSession } from "@/lib/access";
import SopBuilder from "../builder";

export const metadata = { title: "New SOP - Forward Deploy" };

export default async function NewSopPage({
  params,
}: {
  params: Promise<{ dept: string }>;
}) {
  const session = await requireSession();
  const { dept } = await params;
  const department = await findDepartment(dept);
  if (!department) notFound();
  if (!(await canAccessDepartment(session, department.id))) redirect("/sops");

  return (
    <main className="wide">
      <h1>{department.name} - new SOP</h1>
      <p className="muted">
        <Link href={`/sops/${department.slug}`}>&larr; {department.name} SOPs</Link>
        {" - "}one process per SOP; commit, then start the next.
      </p>
      <SopBuilder
        departmentSlug={department.slug}
        departmentName={department.name}
      />
    </main>
  );
}
