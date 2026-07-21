import { inArray } from "drizzle-orm";
import { requireSession } from "@/lib/access";
import { isDeveloperRole } from "@/auth";
import { db, schema } from "@/db";
import { listSops } from "@/lib/sops";
import SopsBrowser from "@/components/sops-browser";

export const metadata = { title: "SOPs - Forward Deploy" };

export default async function SopsPage() {
  const session = await requireSession();

  // Managers see their departments; admins/developers see all.
  let departments;
  if (!isDeveloperRole(session.user.role)) {
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

  const groups = await Promise.all(
    departments.map(async (d, di) => {
      const sops = await listSops(d.slug).catch(() => []);
      return {
        slug: d.slug,
        name: d.name,
        newHref: `/sops/${d.slug}/new`,
        sops: sops.map((s) => ({
          href: `/sops/${d.slug}/${s.slug}`,
          topic: s.topic,
          tools: s.tools,
          owner: s.owner,
          updated: s.updated,
          band: di,
        })),
      };
    })
  );

  return (
    <main>
      <h1>Standard Operating Procedures</h1>
      <p className="muted">
        Each SOP documents one process. They live in your repo, versioned next
        to the code they'll eventually improve.
      </p>
      {groups.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            You're not assigned to a department yet - ask your admin.
          </p>
        </div>
      ) : (
        <SopsBrowser groups={groups} grouped />
      )}
    </main>
  );
}
