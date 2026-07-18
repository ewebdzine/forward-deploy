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

      {sops.length ? (
        <div className="tile-grid">
          {sops.map((s, i) => (
            <Link
              className="tile"
              href={`/sops/${department.slug}/${s.slug}`}
              key={s.path}
            >
              <div className={`tile-band tile-band-slim band-${i % 4}`}>
                <span style={{ fontSize: "1.3rem" }}>
                  {s.topic.slice(0, 1).toUpperCase()}
                </span>
              </div>
              <div className="tile-body">
                <span className="tile-name">{s.topic}</span>
                <span className="tile-chips">
                  {s.tools.slice(0, 3).map((t) => (
                    <span className="tag-chip" key={t}>
                      {t}
                    </span>
                  ))}
                  {s.tools.length > 3 && (
                    <span className="tag-chip">+{s.tools.length - 3}</span>
                  )}
                  {s.updated && <span className="tag-chip">{s.updated}</span>}
                </span>
                {s.owner && (
                  <span className="muted" style={{ fontSize: "0.78rem" }}>
                    {s.owner}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            No SOPs yet. Document your first process - describe it to Claude
            and the draft builds itself.
          </p>
        </div>
      )}
    </main>
  );
}
