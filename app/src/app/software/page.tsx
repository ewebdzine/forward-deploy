import Link from "next/link";
import { requireSession } from "@/lib/access";
import { listSoftwareCanons } from "@/lib/software";
import { softwareDocsPath } from "@/lib/source-control";

export const metadata = { title: "Software - Forward Deploy" };

export default async function SoftwarePage() {
  await requireSession();
  const canons = await listSoftwareCanons().catch(() => []);

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
    </main>
  );
}
