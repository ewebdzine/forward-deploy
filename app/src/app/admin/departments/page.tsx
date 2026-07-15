import { db } from "@/db";
import { createDepartment } from "../actions";

export default async function DepartmentsPage() {
  const departments = await db.query.departments.findMany({
    with: { members: { with: { user: true } } },
    orderBy: (d, { asc }) => asc(d.name),
  });

  return (
    <>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>New department</h2>
        <form action={createDepartment} className="row">
          <div className="stack">
            <label htmlFor="name">Name</label>
            <input id="name" name="name" required placeholder="e.g. Accounting" />
          </div>
          <button type="submit">Create</button>
        </form>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Departments</h2>
        {departments.length ? (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Members</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td className="muted">
                    {d.members.length
                      ? d.members
                          .map((m) => m.user.name ?? m.user.email)
                          .join(", ")
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No departments yet - create the first above.</p>
        )}
      </div>
    </>
  );
}
