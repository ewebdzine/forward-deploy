import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { estimateCostUsd, formatUsd } from "@/lib/pricing";
import { inviteUser, toggleMembership, transferOwnership } from "../actions";

export default async function UsersPage() {
  const [users, departments, usageRows, billedRows, dailyEstimates] = await Promise.all([
    db.query.users.findMany({
      with: { departmentMembers: { with: { department: true } } },
      orderBy: (u, { asc }) => asc(u.email),
    }),
    db.query.departments.findMany({ orderBy: (d, { asc }) => asc(d.name) }),
    db
      .select({
        userId: schema.usageLog.userId,
        turns: sql<number>`count(*)::int`,
        tokensIn: sql<number>`sum(${schema.usageLog.tokensIn})::int`,
        cacheWrite: sql<number>`sum(${schema.usageLog.tokensCacheWrite})::int`,
        tokensOut: sql<number>`sum(${schema.usageLog.tokensOut})::int`,
        cacheRead: sql<number>`sum(${schema.usageLog.tokensCacheRead})::int`,
      })
      .from(schema.usageLog)
      .groupBy(schema.usageLog.userId),
    db.query.billedCosts.findMany({
      orderBy: (b, { desc }) => desc(b.day),
      limit: 7,
    }),
    db
      .select({
        day: sql<string>`to_char(${schema.usageLog.createdAt}, 'YYYY-MM-DD')`,
        tokensIn: sql<number>`sum(${schema.usageLog.tokensIn})::int`,
        cacheWrite: sql<number>`sum(${schema.usageLog.tokensCacheWrite})::int`,
        tokensOut: sql<number>`sum(${schema.usageLog.tokensOut})::int`,
        cacheRead: sql<number>`sum(${schema.usageLog.tokensCacheRead})::int`,
      })
      .from(schema.usageLog)
      .groupBy(sql`to_char(${schema.usageLog.createdAt}, 'YYYY-MM-DD')`),
  ]);
  const usageByUser = new Map(usageRows.map((r) => [r.userId, r]));
  const estimateByDay = new Map(
    dailyEstimates.map((d) => [
      d.day,
      estimateCostUsd({
        tokensIn: d.tokensIn,
        tokensOut: d.tokensOut,
        tokensCacheWrite: d.cacheWrite,
        tokensCacheRead: d.cacheRead,
      }),
    ])
  );

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
            <select id="role" name="role" defaultValue="user">
              <option value="user">user</option>
              <option value="developer">developer</option>
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

      {usageRows.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Token usage by user</h2>
          <p className="muted">
            Every AI turn is attributed - what each person&apos;s planning and
            documenting actually costs. Cache reads are the cheap 90%-discounted
            tokens; input includes cache writes.
          </p>
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th style={{ textAlign: "right" }}>Turns</th>
                <th style={{ textAlign: "right" }}>Input</th>
                <th style={{ textAlign: "right" }}>Output</th>
                <th style={{ textAlign: "right" }}>Cache read</th>
                <th style={{ textAlign: "right" }}>Est. cost</th>
              </tr>
            </thead>
            <tbody>
              {users
                .filter((u) => usageByUser.has(u.id))
                .map((u) => {
                  const r = usageByUser.get(u.id)!;
                  const cost = estimateCostUsd({
                    tokensIn: r.tokensIn,
                    tokensOut: r.tokensOut,
                    tokensCacheWrite: r.cacheWrite,
                    tokensCacheRead: r.cacheRead,
                  });
                  return (
                    <tr key={u.id}>
                      <td>{u.name ?? u.email}</td>
                      <td style={{ textAlign: "right" }}>{r.turns}</td>
                      <td style={{ textAlign: "right" }}>
                        {(r.tokensIn + r.cacheWrite).toLocaleString()}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {r.tokensOut.toLocaleString()}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {r.cacheRead.toLocaleString()}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {cost !== null ? formatUsd(cost) : "-"}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {billedRows.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Billed vs estimated (last 7 days)</h2>
          <p className="muted">
            Billed is Anthropic&apos;s actual invoice truth (Admin API, synced
            daily); estimated is this app&apos;s token ledger at your configured
            prices. A widening gap means the PRICE_PER_MTOK env vars are stale
            - or another tool shares this API key.
          </p>
          <table>
            <thead>
              <tr>
                <th>Day (UTC)</th>
                <th style={{ textAlign: "right" }}>Billed</th>
                <th style={{ textAlign: "right" }}>Estimated (this app)</th>
              </tr>
            </thead>
            <tbody>
              {billedRows.map((b) => {
                const est = estimateByDay.get(b.day) ?? null;
                return (
                  <tr key={b.day}>
                    <td>{b.day}</td>
                    <td style={{ textAlign: "right" }}>
                      {formatUsd(b.amountUsd)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {est !== null ? formatUsd(est) : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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
