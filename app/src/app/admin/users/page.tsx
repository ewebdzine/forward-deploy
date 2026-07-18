import { db } from "@/db";
import { inviteUser, toggleMembership, transferOwnership } from "../actions";

export default async function UsersPage() {
  const [users, departments] = await Promise.all([
    db.query.users.findMany({
      with: { departmentMembers: { with: { department: true } } },
      orderBy: (u, { asc }) => asc(u.email),
    }),
    db.query.departments.findMany({ orderBy: (d, { asc }) => asc(d.name) }),
  ]);

  return (
    <>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Invite a user</h2>
        <p className="muted">
          Creating the account is the invitation - magic links are only sent to
          emails listed below. Share the app URL with them after inviting.
        </p>
        <form action={inviteUser} className="row">
          <div className="stack">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required />
          </div>
          <div className="stack">
            <label htmlFor="name">Name</label>
            <input id="name" name="name" />
          </div>
          <div className="stack">
            <label htmlFor="role">Role</label>
            <select id="role" name="role" defaultValue="manager">
              <option value="manager">manager</option>
              <option value="developer">developer</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div className="stack">
            <label htmlFor="departmentId">Department</label>
            <select id="departmentId" name="departmentId" defaultValue="">
              <option value="">- none -</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit">Invite</button>
        </form>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Offboard - transfer ownership</h2>
        <p className="muted">
          When someone leaves, hand everything to their replacement: their
          SOPs get re-owned in the repo (committed, indexes regenerated),
          their plans reassigned, and their department memberships copied
          over. The SOP content itself is the handover - the replacement
          reads what their predecessor documented.
        </p>
        <form action={transferOwnership} className="row">
          <div className="stack">
            <label htmlFor="fromUserId">From (departing)</label>
            <select id="fromUserId" name="fromUserId" required defaultValue="">
              <option value="" disabled>
                select...
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.email}
                </option>
              ))}
            </select>
          </div>
          <div className="stack">
            <label htmlFor="toUserId">To (replacement)</label>
            <select id="toUserId" name="toUserId" required defaultValue="">
              <option value="" disabled>
                select...
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.email}
                </option>
              ))}
            </select>
          </div>
          <button type="submit">Transfer everything</button>
        </form>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Users</h2>
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Departments</th>
              <th>Assign</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.name ?? "-"}</td>
                <td>
                  <span className="role-chip">{u.role}</span>
                </td>
                <td className="muted">
                  {u.departmentMembers.length
                    ? u.departmentMembers.map((m) => m.department.name).join(", ")
                    : "-"}
                </td>
                <td>
                  <form action={toggleMembership} className="row">
                    <input type="hidden" name="userId" value={u.id} />
                    <select name="departmentId" defaultValue="">
                      <option value="" disabled>
                        toggle...
                      </option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="link-button">
                      apply
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
