import { inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { createDepartment, setDepartmentDeveloper } from "../actions";

export default async function DepartmentsPage() {
  const [departments, developers] = await Promise.all([
    db.query.departments.findMany({
      with: { members: { with: { user: true } } },
      orderBy: (d, { asc }) => asc(d.name),
    }),
    db.query.users.findMany({
      where: inArray(schema.users.role, ["developer", "admin"]),
      orderBy: (u, { asc }) => asc(u.email),
    }),
  ]);
  const soleDeveloper = developers.length === 1 ? developers[0] : null;

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
                <th>Developer</th>
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
                  <td>
                    {soleDeveloper && !d.developerId ? (
                      <span className="muted">
                        {soleDeveloper.name ?? soleDeveloper.email} (automatic -
                        only developer)
                      </span>
                    ) : (
                      <form action={setDepartmentDeveloper} className="row">
                        <input type="hidden" name="departmentId" value={d.id} />
                        <select
                          name="developerId"
                          defaultValue={d.developerId ?? ""}
                        >
                          <option value="">- unassigned -</option>
                          {developers.map((dev) => (
                            <option key={dev.id} value={dev.id}>
                              {dev.name ?? dev.email}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className="link-button">
                          assign
                        </button>
                      </form>
                    )}
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
