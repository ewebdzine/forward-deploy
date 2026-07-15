import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { requireSession, canAccessDepartment } from "@/lib/access";
import { db, schema } from "@/db";
import { PLAN_SECTIONS } from "@/lib/plan-sections";
import SubmitPlanButton from "./submit-button";

export default async function PlanViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const plan = await db.query.plans.findFirst({
    where: eq(schema.plans.id, id),
    with: { department: true, author: true, mockups: true },
  });
  if (!plan) notFound();
  if (!(await canAccessDepartment(session, plan.departmentId))) {
    redirect("/plans");
  }

  const editable =
    plan.status === "draft" || plan.status === "changes_requested";

  return (
    <main>
      <h1>{plan.title}</h1>
      <p className="muted">
        <Link href="/plans">&larr; all plans</Link>
        {" - "}
        {plan.department.name} / {plan.author.name ?? plan.author.email} -{" "}
        <span className={`status-chip status-${plan.status}`}>
          {plan.status.replace(/_/g, " ")}
        </span>
        {editable && (
          <>
            {" - "}
            <Link href={`/plans/${plan.id}/build`}>continue building</Link>
          </>
        )}
      </p>

      {PLAN_SECTIONS.map((s) => {
        const body = (plan.sections[s.key] ?? "").trim();
        return (
          <div className="card sop-body" key={s.key}>
            <h2 style={{ marginTop: 0 }}>{s.label}</h2>
            {body ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
            ) : (
              <p className="muted">(not written yet)</p>
            )}
          </div>
        );
      })}

      {plan.mockups.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Mockups</h2>
          {plan.mockups.map((m) => (
            <figure key={m.id} className="mockup-figure">
              <figcaption className="muted">{m.caption}</figcaption>
              <iframe
                className="mockup-frame"
                sandbox="allow-scripts"
                srcDoc={m.html}
                title={m.caption}
              />
            </figure>
          ))}
        </div>
      )}

      {plan.citations.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Citations</h2>
          <ul>
            {plan.citations.map((c) => (
              <li key={c}>
                <code>{c}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {editable && <SubmitPlanButton planId={plan.id} />}
    </main>
  );
}
