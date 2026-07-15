import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canAccessDepartment, findDepartment, requireSession } from "@/lib/access";
import { listSops } from "@/lib/sops";

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
      <h1>{department.name} - SOPs</h1>
      <p className="muted">
        <Link href="/sops">&larr; all departments</Link>
      </p>
      <div className="card">
        {sops.length ? (
          <table>
            <thead>
              <tr>
                <th>Topic</th>
                <th>Tools</th>
                <th>Owner</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {sops.map((s) => (
                <tr key={s.path}>
                  <td>
                    <Link href={`/sops/${department.slug}/${s.slug}`}>
                      {s.topic}
                    </Link>
                  </td>
                  <td className="muted">{s.tools.join(", ") || "-"}</td>
                  <td className="muted">{s.owner || "-"}</td>
                  <td className="muted">{s.updated || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">
            No SOPs yet. Document your first process - each SOP covers one
            process or tool, and you can create as many as the department needs.
          </p>
        )}
      </div>
      <p>
        <Link href={`/sops/${department.slug}/new`}>+ New SOP</Link>
      </p>
    </main>
  );
}
