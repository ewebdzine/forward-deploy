import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { requireSession } from "@/lib/access";
import { isDeveloperRole } from "@/auth";
import { db, schema } from "@/db";
import { dismissCapture } from "./actions";

export const metadata = { title: "Captures - Forward Deploy" };

export default async function CapturesPage() {
  const session = await requireSession();

  const captures = await db.query.captures.findMany({
    where: and(
      eq(schema.captures.userId, session.user.id),
      eq(schema.captures.status, "open")
    ),
    orderBy: (c, { desc }) => desc(c.updatedAt),
  });

  const memberships = await db.query.departmentMembers.findMany({
    where: (m, { eq: e }) => e(m.userId, session.user.id),
  });
  const departments =
    !isDeveloperRole(session.user.role)
      ? memberships.length
        ? await db.query.departments.findMany({
            where: inArray(
              schema.departments.id,
              memberships.map((m) => m.departmentId)
            ),
            orderBy: (d, { asc }) => asc(d.name),
          })
        : []
      : await db.query.departments.findMany({
          orderBy: (d, { asc }) => asc(d.name),
        });

  return (
    <main>
      <h1>Captures</h1>
      <p className="muted">
        Notes you sent the Forward Deploy Slack bot. Turn each into an SOP or
        a plan - the builder starts pre-loaded with what you wrote.
      </p>
      {captures.length === 0 && (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Nothing captured. DM the Forward Deploy bot in Slack with a note,
            an idea, or a process brain-dump, and it lands here.
          </p>
        </div>
      )}
      {captures.map((c) => (
        <div className="card" key={c.id}>
          <h2 style={{ marginTop: 0 }}>{c.title}</h2>
          <p className="muted" style={{ fontSize: "0.78rem" }}>
            {c.transcript.length} message{c.transcript.length === 1 ? "" : "s"}{" "}
            - {c.updatedAt.toISOString().slice(0, 16).replace("T", " ")}
          </p>
          <div className="capture-transcript">
            {c.transcript.map((t) => (
              <p key={t.ts} style={{ margin: "0 0 0.4rem" }}>
                {t.text}
              </p>
            ))}
          </div>
          <div className="row" style={{ marginTop: "0.6rem" }}>
            {departments.map((d) => (
              <Link
                key={d.id}
                className="button-secondary"
                href={`/sops/${d.slug}/new?capture=${c.id}`}
              >
                Start SOP in {d.name}
              </Link>
            ))}
            <form action={dismissCapture}>
              <input type="hidden" name="captureId" value={c.id} />
              <button type="submit" className="link-button">
                Dismiss
              </button>
            </form>
          </div>
        </div>
      ))}
    </main>
  );
}
