import Link from "next/link";
import { inArray } from "drizzle-orm";
import { requireSession } from "@/lib/access";
import { db, schema } from "@/db";
import { PLAN_SECTIONS, filledSectionCount, parseOpenQuestionsDetailed } from "@/lib/plan-sections";
import { listSoftwareCanons, matchPlanSoftware } from "@/lib/software";

export const metadata = { title: "Plans - Forward Deploy" };

const FILTERS = [
  { key: "", label: "all" },
  { key: "queue", label: "review queue" },
  { key: "in_development", label: "in development" },
  { key: "shipped", label: "shipped" },
] as const;

const QUEUE_STATUSES = ["submitted", "in_review", "changes_requested"] as const;

/** Band tint by where the plan sits in the workflow. */
function bandClass(status: string): string {
  if (status === "draft") return "band-st-draft";
  if (["approved", "in_development", "shipped"].includes(status)) return "band-st-good";
  if (status === "declined") return "band-st-declined";
  return "band-st-queue";
}

function filterUrl(filter: string, dept: string): string {
  const params = new URLSearchParams();
  if (filter) params.set("filter", filter);
  if (dept) params.set("dept", dept);
  const qs = params.toString();
  return qs ? `/plans?${qs}` : "/plans";
}

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; dept?: string }>;
}) {
  const session = await requireSession();
  const { filter = "", dept = "" } = await searchParams;

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

  // Department filter chips come from the departments the viewer can see.
  const visibleDepartments = [
    ...new Map(plans.map((p) => [p.department.slug, p.department])).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));

  if (filter === "queue") {
    plans = plans.filter((p) =>
      (QUEUE_STATUSES as readonly string[]).includes(p.status)
    );
  } else if (filter) {
    plans = plans.filter((p) => p.status === filter);
  }
  if (dept) {
    plans = plans.filter((p) => p.department.slug === dept);
  }

  const softwareCanons = await listSoftwareCanons().catch(() => []);

  return (
    <main>
      <div className="page-head">
        <div>
          <h1>Plans</h1>
          <p className="muted" style={{ margin: 0 }}>
            Developer-ready proposals, built with Claude from your SOPs,
            canons, and codebase.
          </p>
        </div>
        <Link className="button-secondary" href="/plans/new">
          + New plan
        </Link>
      </div>
      <div className="filter-row">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            className={`filter-pill${filter === f.key ? " active" : ""}`}
            href={filterUrl(f.key, dept)}
          >
            {f.label}
          </Link>
        ))}
      </div>
      {visibleDepartments.length > 1 && (
        <div className="filter-row">
          <Link
            className={`filter-pill${!dept ? " active" : ""}`}
            href={filterUrl(filter, "")}
          >
            all departments
          </Link>
          {visibleDepartments.map((d) => (
            <Link
              key={d.slug}
              className={`filter-pill${dept === d.slug ? " active" : ""}`}
              href={filterUrl(filter, d.slug)}
            >
              {d.name}
            </Link>
          ))}
        </div>
      )}

      {plans.length ? (
        <div className="tile-grid tile-grid-wide">
          {plans.map((p) => {
            const filled = filledSectionCount(p.sections);
            const questions = parseOpenQuestionsDetailed(p.sections);
            const forManager = questions.filter((q) => q.audience === "manager").length;
            const forDev = questions.length - forManager;
            const software = matchPlanSoftware(p, softwareCanons).slice(0, 5);
            return (
              <Link className="tile" href={`/plans/${p.id}`} key={p.id}>
                <div className={`tile-band tile-band-slim ${bandClass(p.status)}`}>
                  <span className={`status-chip status-${p.status}`}>
                    {p.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="tile-body">
                  <span className="tile-name">{p.title}</span>
                  <span className="tile-chips">
                    <span className="tag-chip">{p.department.name}</span>
                    <span className="tag-chip">
                      {filled}/{PLAN_SECTIONS.length} sections
                    </span>
                    {forManager > 0 && (
                      <span className="tag-chip tag-chip-warn">
                        {forManager} question{forManager === 1 ? "" : "s"} for the planner
                      </span>
                    )}
                    {forDev > 0 && (
                      <span className="tag-chip">
                        {forDev} for dev team
                      </span>
                    )}
                    <span className="tag-chip">
                      {p.updatedAt.toISOString().slice(0, 10)}
                    </span>
                  </span>
                  <span className="tile-foot">
                    <span className="muted" style={{ fontSize: "0.78rem" }}>
                      {p.author.name ?? p.author.email}
                    </span>
                    {software.length > 0 && (
                      <span className="soft-badges">
                        {software.map((s) =>
                          s.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={s.slug}
                              src={s.logoUrl}
                              alt={s.software}
                              title={s.software}
                            />
                          ) : (
                            <span
                              key={s.slug}
                              className="soft-badge-letter"
                              title={s.software}
                            >
                              {s.software.slice(0, 1).toUpperCase()}
                            </span>
                          )
                        )}
                      </span>
                    )}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            {filter
              ? "No plans match this filter."
              : "No plans yet. Start the first one - describe an inefficiency and build the case for fixing it."}
          </p>
        </div>
      )}
    </main>
  );
}
