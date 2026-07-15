import { inArray } from "drizzle-orm";
import { requireSession } from "@/lib/access";
import { db, schema } from "@/db";
import { createPlan } from "../actions";

export const metadata = { title: "New plan - Forward Deploy" };

export default async function NewPlanPage() {
  const session = await requireSession();

  let departments;
  if (session.user.role === "manager") {
    const memberships = await db.query.departmentMembers.findMany({
      where: (m, { eq }) => eq(m.userId, session.user.id),
    });
    departments = memberships.length
      ? await db.query.departments.findMany({
          where: inArray(
            schema.departments.id,
            memberships.map((m) => m.departmentId)
          ),
          orderBy: (d, { asc }) => asc(d.name),
        })
      : [];
  } else {
    departments = await db.query.departments.findMany({
      orderBy: (d, { asc }) => asc(d.name),
    });
  }

  return (
    <main>
      <h1>New plan</h1>
      {departments.length ? (
        <div className="card">
          <form action={createPlan} className="row">
            <div className="stack">
              <label htmlFor="departmentId">Department</label>
              <select id="departmentId" name="departmentId" required>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="stack" style={{ flex: 1 }}>
              <label htmlFor="title">Working title (optional - Claude will refine it)</label>
              <input
                id="title"
                name="title"
                placeholder="e.g. Stop re-typing invoices between systems"
              />
            </div>
            <button type="submit">Start planning</button>
          </form>
        </div>
      ) : (
        <div className="card">
          <p className="muted">
            You&apos;re not assigned to a department yet - ask your admin.
          </p>
        </div>
      )}
    </main>
  );
}
