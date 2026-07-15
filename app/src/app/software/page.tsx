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
      {canons.length ? (
        <div className="tile-grid">
          {canons.map((c, i) => (
            <Link className="tile" href={`/software/${c.slug}`} key={c.slug}>
              <div
                className={`tile-band ${c.logoUrl ? "band-logo" : `band-${(i + 2) % 4}`}`}
              >
                {c.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.logoUrl} alt={`${c.software} logo`} />
                ) : (
                  <span>{c.software.slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div className="tile-body">
                <span className="tile-name">{c.software}</span>
                <span className="tile-chips">
                  {c.vendor && <span className="tag-chip">{c.vendor}</span>}
                  {c.usedBy.length > 0 && (
                    <span className="tag-chip">
                      used by {c.usedBy.join(", ")}
                    </span>
                  )}
                  {c.captured && (
                    <span className="tag-chip">captured {c.captured}</span>
                  )}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card">
          <p className="muted">
            No software is documented yet ({softwareDocsPath()}/ is empty).
            Mention the tools you use in your SOPs - their <code>tools:</code>{" "}
            lists become the worklist - and have the dev team run{" "}
            <code>/forward-deploy:capture-software</code> in Claude Code to
            research and commit a canon per product.
          </p>
        </div>
      )}

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
