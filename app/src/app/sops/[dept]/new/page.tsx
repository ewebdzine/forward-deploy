import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { canAccessDepartment, findDepartment, requireSession } from "@/lib/access";
import { db, schema } from "@/db";
import SopBuilder from "../builder";

export const metadata = { title: "New SOP - Forward Deploy" };

export default async function NewSopPage({
  params,
  searchParams,
}: {
  params: Promise<{ dept: string }>;
  searchParams: Promise<{ capture?: string }>;
}) {
  const session = await requireSession();
  const { dept } = await params;
  const { capture } = await searchParams;
  const department = await findDepartment(dept);
  if (!department) notFound();
  if (!(await canAccessDepartment(session, department.id))) redirect("/sops");

  // Arriving from a Slack capture: pre-load the composer with the note so the
  // interview starts from what was already written down.
  let seedText: string | undefined;
  if (capture) {
    const row = await db.query.captures.findFirst({
      where: and(
        eq(schema.captures.id, capture),
        eq(schema.captures.userId, session.user.id)
      ),
    });
    if (row) {
      seedText = row.transcript.map((t) => t.text).join("\n");
    }
  }

  return (
    <SopBuilder
      departmentSlug={department.slug}
      departmentName={department.name}
      seedText={seedText}
    />
  );
}
