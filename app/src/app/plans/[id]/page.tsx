import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { requireSession, canAccessDepartment } from "@/lib/access";
import { db, schema } from "@/db";
import { PLAN_SECTIONS } from "@/lib/plan-sections";
import { devTransitionsFrom } from "@/lib/plan-status";
import { addPlanMessage, setPlanStatus } from "../actions";
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
    with: {
      department: true,
      author: true,
      mockups: true,
      messages: { with: { author: true } },
    },
  });
  if (!plan) notFound();
  if (!(await canAccessDepartment(session, plan.departmentId))) {
    redirect("/plans");
  }

  const editable =
    plan.status === "draft" || plan.status === "changes_requested";
  const isDev =
    session.user.role === "developer" || session.user.role === "admin";
  const transitions = isDev ? devTransitionsFrom(plan.status) : [];
  const thread = plan.messages.sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

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

      {plan.status !== "draft" && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Review thread</h2>
          {thread.length ? (
            <div className="thread">
              {thread.map((m) => (
                <div key={m.id} className="thread-msg">
                  <div className="muted">
                    <strong>{m.author.name ?? m.author.email}</strong>{" "}
                    <span className="role-chip">{m.author.role}</span>{" "}
                    {m.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  </div>
                  <p style={{ margin: "0.25rem 0 0", whiteSpace: "pre-wrap" }}>
                    {m.body}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No messages yet.</p>
          )}
          <form action={addPlanMessage} className="stack" style={{ marginTop: "0.75rem" }}>
            <input type="hidden" name="planId" value={plan.id} />
            <textarea
              name="body"
              rows={3}
              required
              placeholder="Reply to the thread..."
            />
            <button type="submit">Post reply</button>
          </form>
        </div>
      )}

      {transitions.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Dev team: advance status</h2>
          <form action={setPlanStatus} className="row">
            <input type="hidden" name="planId" value={plan.id} />
            <select name="status" defaultValue={transitions[0]}>
              {transitions.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <button type="submit">Set status</button>
          </form>
          <p className="muted" style={{ marginBottom: 0 }}>
            The manager sees the change immediately; use the thread to say why.
          </p>
        </div>
      )}
    </main>
  );
}
