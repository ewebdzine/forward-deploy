import Link from "next/link";
import { inArray } from "drizzle-orm";
import { requireSession } from "@/lib/access";
import { db, schema } from "@/db";
import { listSops } from "@/lib/sops";

export const metadata = { title: "SOPs - Forward Deploy" };

export default async function SopsPage() {
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

  const withSops = await Promise.all(
    departments.map(async (d) => ({
      ...d,
      sops: await listSops(d.slug).catch(() => []),
    }))
  );

  return (
    <main>
      <h1>Standard Operating Procedures</h1>
      <p className="muted">
        Each SOP documents one process. They live in your repo, versioned next
        to the code they'll eventually improve.
      </p>
      {withSops.length === 0 && (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            You're not assigned to a department yet - ask your admin.
          </p>
        </div>
      )}
      {withSops.map((d, di) => (
        <section key={d.id}>
          <div className="section-head">
            <h2>
              <Link href={`/sops/${d.slug}`}>{d.name}</Link>{" "}
              <span className="muted" style={{ fontWeight: 400 }}>
                - {d.sops.length} SOP{d.sops.length === 1 ? "" : "s"}
              </span>
            </h2>
            <Link className="button-secondary" href={`/sops/${d.slug}/new`}>
              + New SOP
            </Link>
          </div>
          {d.sops.length ? (
            <div className="tile-grid">
              {d.sops.map((s) => (
                <Link
                  className="tile"
                  href={`/sops/${d.slug}/${s.slug}`}
                  key={s.path}
                >
                  <div className={`tile-band tile-band-slim band-${di % 4}`}>
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
                      {s.updated && (
                        <span className="tag-chip">{s.updated}</span>
                      )}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="card">
              <p className="muted" style={{ margin: 0 }}>
                No SOPs yet - document your first process. One process per SOP;
                create as many as the department needs.
              </p>
            </div>
          )}
        </section>
      ))}
    </main>
  );
}
