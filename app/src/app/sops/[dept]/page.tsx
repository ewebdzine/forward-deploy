import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canAccessDepartment, findDepartment, requireSession } from "@/lib/access";
import { listSops } from "@/lib/sops";
import SopsBrowser from "@/components/sops-browser";

export default async function DepartmentSopsPage({
  params,
}: {
  params: Promise<{ dept: string }>;
}) {
  const session = await requireSession();
  const { dept } = await params;
  const department = await findDepartment(dept);
  if (!department) notFound();
  if (!(await canAccessDepartment(session, department.id))) redirect("/sops");

  const sops = await listSops(department.slug).catch(() => []);

  return (
    <main>
      <div className="page-head">
        <div>
          <h1>{department.name} - SOPs</h1>
          <p className="muted" style={{ margin: 0 }}>
            <Link href="/sops">&larr; all departments</Link> - one process per
            SOP; create as many as the department needs.
          </p>
        </div>
        <Link className="button-secondary" href={`/sops/${department.slug}/new`}>
          + New SOP
        </Link>
      </div>

      <SopsBrowser
        grouped={false}
        groups={[
          {
            slug: department.slug,
            name: department.name,
            newHref: `/sops/${department.slug}/new`,
            sops: sops.map((s, i) => ({
              href: `/sops/${department.slug}/${s.slug}`,
              topic: s.topic,
              tools: s.tools,
              owner: s.owner,
              updated: s.updated,
              band: i,
            })),
          },
        ]}
      />
    </main>
  );
}
