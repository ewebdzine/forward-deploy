import Link from "next/link";
import { inArray } from "drizzle-orm";
import { requireSession } from "@/lib/access";
import { db, schema } from "@/db";

export const metadata = { title: "Plans - Forward Deploy" };

export default async function PlansPage() {
  const session = await requireSession();

  let plans;
  if (session.user.role === "manager") {
    const memberships = await db.query.departmentMembers.findMany({
      where: (m, { eq }) => eq(m.userId, session.user.id),
    });
    plans = memberships.length
      ? await db.query.plans.findMany({
          where: inArray(
            schema.plans.departmentId,
            memberships.map((m) => m.departmentId)
          ),
          with: { department: true, author: true },
          orderBy: (p, { desc }) => desc(p.updatedAt),
        })
      : [];
  } else {
    plans = await db.query.plans.findMany({
      with: { department: true, author: true },
      orderBy: (p, { desc }) => desc(p.updatedAt),
    });
  }

  return (
    <main>
      <h1>Plans</h1>
      <p className="muted">
        Developer-ready proposals, built with Claude from your SOPs, canons,
        and codebase. <Link href="/plans/new">+ New plan</Link>
      </p>
      <div className="card">
        {plans.length ? (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Department</th>
                <th>Author</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/plans/${p.id}`}>{p.title}</Link>
                  </td>
                  <td className="muted">{p.department.name}</td>
                  <td className="muted">{p.author.name ?? p.author.email}</td>
                  <td>
                    <span className={`status-chip status-${p.status}`}>
                      {p.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="muted">
                    {p.updatedAt.toISOString().slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">
            No plans yet. <Link href="/plans/new">Start the first one</Link> -
            describe an inefficiency and build the case for fixing it.
          </p>
        )}
      </div>
    </main>
  );
}
