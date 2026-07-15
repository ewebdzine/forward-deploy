import Link from "next/link";
import { requireSession } from "@/lib/access";
import { softwareDocsPath } from "@/lib/source-control";

export const metadata = { title: "Add software - Forward Deploy" };

export default async function AddSoftwarePage() {
  await requireSession();

  return (
    <main>
      <h1>Add software</h1>
      <p className="muted">
        <Link href="/software">&larr; all software</Link>
      </p>
      <div className="card">
        <p>
          Software canons are researched and committed by the dev team from
          Claude Code - the research reads the vendor&apos;s public developer
          docs, which the app deliberately can&apos;t browse itself. To add
          one, a developer runs:
        </p>
        <pre className="file-view">/forward-deploy:capture-software &lt;product name&gt;</pre>
        <p className="muted">
          It researches the product&apos;s APIs, webhooks, auth model, and
          limits, writes the canon to <code>{softwareDocsPath()}/</code> in the
          repo for review, and regenerates the index. The canon then appears
          here and the plan builder starts citing it in feasibility answers.
        </p>
        <p style={{ marginBottom: 0 }}>
          <strong>Managers:</strong> the fastest way to get a tool documented
          is to name it in your SOPs - the <code>tools:</code> lists are the
          dev team&apos;s worklist - or mention it in a plan: Claude flags
          undocumented software in the plan&apos;s open questions
          automatically.
        </p>
      </div>
    </main>
  );
}
