import Link from "next/link";
import { inArray } from "drizzle-orm";
import { requireSession } from "@/lib/access";
import { db, schema } from "@/db";
import { getSourceControl, repoDescription } from "@/lib/source-control";

export default async function HomePage() {
  const session = await requireSession();

  const memberships = await db.query.departmentMembers.findMany({
    where: (m, { eq }) => eq(m.userId, session.user.id),
  });
  const departments = memberships.length
    ? await db.query.departments.findMany({
        where: inArray(
          schema.departments.id,
          memberships.map((m) => m.departmentId)
        ),
      })
    : [];

  let canonify = false;
  let repoOk = true;
  try {
    canonify = await getSourceControl().fileExists("CANONIFY.md");
  } catch {
    repoOk = false;
  }

  return (
    <main>
      <h1>Welcome{session.user.name ? `, ${session.user.name}` : ""}</h1>
      <p className="muted">
        Document your department, then turn its inefficiencies into
        developer-ready plans.
      </p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Your departments</h2>
        {departments.length ? (
          <ul>
            {departments.map((d) => (
              <li key={d.id}>
                <Link href={`/sops/${d.slug}`}>{d.name}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">
            None yet - an admin assigns you to departments under Admin &gt;
            Users.
          </p>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Connected repo</h2>
        <p>
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
              not reachable - check GITHUB_TOKEN / REPO_* env vars (see
              /api/health)
            </span>
          )}
        </p>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Document your department</h2>
        <p className="muted">
          Write <Link href="/sops">SOPs</Link> with Claude - one per process,
          committed to your repo. The plan builder (Phase 3) lands next and
          draws on every SOP you write.
        </p>
      </div>
    </main>
  );
}
