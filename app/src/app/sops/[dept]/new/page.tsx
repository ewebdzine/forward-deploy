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
    <SopBuilder
      departmentSlug={department.slug}
      departmentName={department.name}
    />
  );
}
