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

  const withCounts = await Promise.all(
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
      {withCounts.length === 0 && (
        <div className="card">
          <p className="muted">
            You're not assigned to a department yet - ask your admin.
          </p>
        </div>
      )}
      {withCounts.map((d) => (
        <div className="card" key={d.id}>
          <h2 style={{ marginTop: 0 }}>
            <Link href={`/sops/${d.slug}`}>{d.name}</Link>{" "}
            <span className="muted" style={{ fontWeight: 400 }}>
              - {d.sops.length} SOP{d.sops.length === 1 ? "" : "s"}
            </span>
          </h2>
          {d.sops.length > 0 && (
            <ul className="file-list">
              {d.sops.map((s) => (
                <li key={s.path}>
                  &#128196;{" "}
                  <Link href={`/sops/${d.slug}/${s.slug}`}>{s.topic}</Link>
                  {s.tools.length > 0 && (
                    <span className="muted"> - {s.tools.join(", ")}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link href={`/sops/${d.slug}/new`}>+ New SOP</Link>
        </div>
      ))}
    </main>
  );
}
