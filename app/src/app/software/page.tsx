import Link from "next/link";
import { requireSession } from "@/lib/access";
import { findUndocumentedTools, listSoftwareCanons } from "@/lib/software";
import { softwareDocsPath } from "@/lib/source-control";

export const metadata = { title: "Software - Forward Deploy" };

export default async function SoftwarePage() {
  await requireSession();
  const canons = await listSoftwareCanons().catch(() => []);
  const pending = await findUndocumentedTools(canons).catch(() => []);

  return (
    <main>
      <h1>Software</h1>
      <p className="muted">
        One canon per product the company uses - its APIs, webhooks, and docs,
        researched by the dev team. The plan builder reads these before
        assessing integration feasibility.
      </p>
      <div className="card">
        {canons.length ? (
          <table>
            <thead>
              <tr>
                <th>Software</th>
                <th>Vendor</th>
                <th>Used by</th>
                <th>Captured</th>
              </tr>
            </thead>
            <tbody>
              {canons.map((c) => (
                <tr key={c.slug}>
                  <td>
                    <Link href={`/software/${c.slug}`}>{c.software}</Link>
                  </td>
                  <td className="muted">{c.vendor || "-"}</td>
                  <td className="muted">{c.usedBy.join(", ") || "-"}</td>
                  <td className="muted">{c.captured || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">
            No software is documented yet ({softwareDocsPath()}/ is empty).
            Mention the tools you use in your SOPs - their <code>tools:</code>{" "}
            lists become the worklist - and have the dev team run{" "}
            <code>/forward-deploy:capture-software</code> in Claude Code to
            research and commit a canon per product.
          </p>
        )}
      </div>

      {pending.length > 0 && (
        <>
          <div className="section-head">
            <h2>Pending developer review</h2>
            <Link className="button-secondary" href="/software/add">
              How to document
            </Link>
          </div>
          <div className="card">
            <p className="muted" style={{ marginTop: 0 }}>
              Named in department SOPs but not documented yet. Each becomes a
              canon when a developer runs{" "}
              <code>/forward-deploy:capture-software &lt;name&gt;</code>.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Tool</th>
                  <th>Named by</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((t) => (
                  <tr key={t.tool}>
                    <td>{t.tool}</td>
                    <td className="muted">{t.departments.join(", ")}</td>
                    <td>
                      <span className="status-chip status-submitted">
                        pending review
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
