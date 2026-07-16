import Link from "next/link";
import { inArray } from "drizzle-orm";
import { requireSession } from "@/lib/access";
import { db, schema } from "@/db";
import { PLAN_SECTIONS, filledSectionCount, parseOpenQuestions } from "@/lib/plan-sections";

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
      <p className="muted" style={{ marginBottom: "0.25rem" }}>
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={filterUrl(f.key, dept)}
            style={{ marginRight: "0.75rem", fontWeight: filter === f.key ? 700 : 400 }}
          >
            {f.label}
          </Link>
        ))}
      </p>
      {visibleDepartments.length > 1 && (
        <p className="muted">
          <Link
            href={filterUrl(filter, "")}
            style={{ marginRight: "0.75rem", fontWeight: !dept ? 700 : 400 }}
          >
            all departments
          </Link>
          {visibleDepartments.map((d) => (
            <Link
              key={d.slug}
              href={filterUrl(filter, d.slug)}
              style={{ marginRight: "0.75rem", fontWeight: dept === d.slug ? 700 : 400 }}
            >
              {d.name}
            </Link>
          ))}
        </p>
      )}

      {plans.length ? (
        <div className="tile-grid tile-grid-wide">
          {plans.map((p) => {
            const filled = filledSectionCount(p.sections);
            const openQ = parseOpenQuestions(p.sections).length;
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
                    {openQ > 0 && (
                      <span className="tag-chip tag-chip-warn">
                        {openQ} open question{openQ === 1 ? "" : "s"}
                      </span>
                    )}
                    <span className="tag-chip">
                      {p.updatedAt.toISOString().slice(0, 10)}
                    </span>
                  </span>
                  <span className="muted" style={{ fontSize: "0.78rem" }}>
                    {p.author.name ?? p.author.email}
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
