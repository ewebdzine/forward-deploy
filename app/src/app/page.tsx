import Link from "next/link";
import { inArray } from "drizzle-orm";
import { requireSession } from "@/lib/access";
import { db, schema } from "@/db";
import { listSops } from "@/lib/sops";
import { listSoftwareCanons } from "@/lib/software";
import { getSourceControl, repoDescription } from "@/lib/source-control";

export default async function HomePage() {
  const session = await requireSession();

  // Managers see their departments; admins/developers see all.
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

  const plans = departments.length
    ? await db.query.plans.findMany({
        where: inArray(
          schema.plans.departmentId,
          departments.map((d) => d.id)
        ),
      })
    : [];

  const [departmentTiles, software] = await Promise.all([
    Promise.all(
      departments.map(async (d) => ({
        ...d,
        sopCount: (await listSops(d.slug).catch(() => [])).length,
        planCount: plans.filter((p) => p.departmentId === d.id).length,
        openPlans: plans.filter(
          (p) =>
            p.departmentId === d.id &&
            !["shipped", "declined"].includes(p.status)
        ).length,
      }))
    ),
    listSoftwareCanons().catch(() => []),
  ]);

  let canonify = false;
  let repoOk = true;
  try {
    canonify = await getSourceControl().fileExists("CANONIFY.md");
  } catch {
    repoOk = false;
  }

  const hour = new Date().getHours();
  const daypart = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const firstName = (session.user.name ?? "").split(" ")[0];

  const totalSops = departmentTiles.reduce((n, d) => n + d.sopCount, 0);
  const PENDING = [
    "submitted",
    "in_review",
    "changes_requested",
    "approved",
    "in_development",
  ];
  const pendingPlans = plans.filter((p) => PENDING.includes(p.status)).length;
  const shippedPlans = plans.filter((p) => p.status === "shipped").length;
  const isAdmin = session.user.role === "admin";

  return (
    <main>
      <h1>
        Good {daypart}
        {firstName ? `, ${firstName}` : ""}
      </h1>
      <p className="muted">
        Document your department, then turn its inefficiencies into
        developer-ready plans.
      </p>

      <div className="stat-grid">
        <Link className="stat-card" href="/sops">
          <span className="stat-label">Total SOPs</span>
          <span className="stat-value">{totalSops}</span>
          <span className="stat-sub">
            across {departmentTiles.length} department
            {departmentTiles.length === 1 ? "" : "s"}
          </span>
        </Link>
        <Link className="stat-card" href="/plans?filter=queue">
          <span className="stat-label">Plans pending</span>
          <span className="stat-value">{pendingPlans}</span>
          <span className="stat-sub">submitted through in development</span>
        </Link>
        <Link className="stat-card" href="/plans?filter=shipped">
          <span className="stat-label">Plans deployed</span>
          <span className="stat-value">{shippedPlans}</span>
          <span className="stat-sub">shipped by the dev team</span>
        </Link>
      </div>

      <div className="section-head">
        <h2>Departments</h2>
        {isAdmin && (
          <Link className="button-secondary" href="/admin/departments">
            + Add department
          </Link>
        )}
      </div>
      {departmentTiles.length ? (
        <div className="tile-grid">
          {departmentTiles.map((d, i) => (
            <Link className="tile" href={`/sops/${d.slug}`} key={d.id}>
              <div className={`tile-band band-${i % 4}`}>
                <span>{d.name.slice(0, 1).toUpperCase()}</span>
              </div>
              <div className="tile-body">
                <span className="tile-name">{d.name}</span>
                <span className="tile-chips">
                  <span className="tag-chip">
                    {d.sopCount} SOP{d.sopCount === 1 ? "" : "s"}
                  </span>
                  <span className="tag-chip">
                    {d.planCount} plan{d.planCount === 1 ? "" : "s"}
                  </span>
                  {d.openPlans > 0 && (
                    <span className="tag-chip">{d.openPlans} open</span>
                  )}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            {session.user.role === "manager"
              ? "You're not assigned to a department yet - ask your admin."
              : "No departments yet - create them under Manage > Departments."}
          </p>
        </div>
      )}

      <div className="section-head">
        <h2>Software</h2>
        <Link className="button-secondary" href="/software/add">
          + Add software
        </Link>
      </div>
      {software.length ? (
        <div className="tile-grid">
          {software.map((s, i) => (
            <Link className="tile" href={`/software/${s.slug}`} key={s.slug}>
              <div className={`tile-band band-${(i + 2) % 4}`}>
                <span>{s.software.slice(0, 1).toUpperCase()}</span>
              </div>
              <div className="tile-body">
                <span className="tile-name">{s.software}</span>
                <span className="tile-chips">
                  {s.vendor && <span className="tag-chip">{s.vendor}</span>}
                  {s.usedBy.length > 0 && (
                    <span className="tag-chip">
                      {s.usedBy.length} dept{s.usedBy.length === 1 ? "" : "s"}
                    </span>
                  )}
                  {s.captured && (
                    <span className="tag-chip">captured {s.captured}</span>
                  )}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            No software documented yet. Name your tools in SOPs, then have the
            dev team run <code>/forward-deploy:capture-software</code> - each
            product becomes a card here.
          </p>
        </div>
      )}

      <h2>Connected repo</h2>
      <div className="card">
        <p style={{ margin: 0 }}>
          {repoOk ? (
            <>
              <span className="badge-ok">connected</span> - {repoDescription()}{" "}
              - <Link href="/repo">browse</Link>
              <br />
              <span className="muted">
                Canonify canons:{" "}
                {canonify
                  ? "present - plans will cite your canonical patterns."
                  : "not found - plans will explore raw code only (consider /canonify:kickoff)."}
              </span>
            </>
          ) : (
            <span className="badge-warn">
              not reachable - check the source-control env vars (see /api/health)
            </span>
          )}
        </p>
      </div>
    </main>
  );
}
