import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { requireSession, canAccessDepartment } from "@/lib/access";
import { isDeveloperRole } from "@/auth";
import { db, schema } from "@/db";
import { PLAN_SECTIONS, parseOpenQuestionsDetailed } from "@/lib/plan-sections";
import { devTransitionsFrom } from "@/lib/plan-status";
import { estimateCostUsd, formatUsd } from "@/lib/pricing";
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
    isDeveloperRole(session.user.role);
  const planSession = await db.query.planSessions.findFirst({
    where: eq(schema.planSessions.planId, plan.id),
  });
  const usageRows = await db.query.usageLog.findMany({
    where: eq(schema.usageLog.refId, plan.id),
  });
  const PHASES = [
    { kind: "plan", label: "Planning (in-app)" },
    { kind: "review", label: "Dev review (Claude Code)" },
    { kind: "build", label: "Build (Claude Code)" },
  ] as const;
  const phaseRows = PHASES.map((p) => {
    const rows = usageRows.filter((r) => r.kind === p.kind);
    const sum = rows.reduce(
      (b, r) => ({
        turns: b.turns + 1,
        tokensIn: b.tokensIn + r.tokensIn,
        tokensOut: b.tokensOut + r.tokensOut,
        tokensCacheWrite: b.tokensCacheWrite + r.tokensCacheWrite,
        tokensCacheRead: b.tokensCacheRead + r.tokensCacheRead,
        api: b.api || r.source === "api",
      }),
      { turns: 0, tokensIn: 0, tokensOut: 0, tokensCacheWrite: 0, tokensCacheRead: 0, api: false }
    );
    return { ...p, sum };
  }).filter((p) => p.sum.turns > 0);
  const turnCount = ((planSession?.transcript as unknown[]) ?? []).length;
  const openQuestions = parseOpenQuestionsDetailed(plan.sections);
  const forManager = openQuestions.filter((q) => q.audience === "manager").length;
  const forDev = openQuestions.length - forManager;
  const managerTotal = plan.resolvedQuestions + forManager;
  const devTotal = plan.resolvedDevQuestions + forDev;
  const totalQuestions = managerTotal + devTotal;
  const managerPct =
    managerTotal > 0
      ? Math.round((plan.resolvedQuestions / managerTotal) * 100)
      : 0;
  const devPct =
    devTotal > 0
      ? Math.round((plan.resolvedDevQuestions / devTotal) * 100)
      : 0;
  const transitions = isDev ? devTransitionsFrom(plan.status) : [];
  const thread = plan.messages.sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  return (
    <main>
      <div className="page-head">
        <div>
          <h1>{plan.title}</h1>
          <p className="muted" style={{ margin: 0 }}>
            <Link href="/plans">&larr; all plans</Link>
            {" - "}
            {plan.department.name} / {plan.author.name ?? plan.author.email} -{" "}
            <span className={`status-chip status-${plan.status}`}>
              {plan.status.replace(/_/g, " ")}
            </span>
          </p>
        </div>
      </div>

      {editable && (
        <div className="plan-actions">
          <div className="card action-card">
            <h2 style={{ marginTop: 0 }}>Keep shaping the plan</h2>
            <p className="muted">
              Add context, extra feature requests, or anything the plan should
              cover that no question has asked about - just tell Claude.
            </p>
            <Link className="button-secondary" href={`/plans/${plan.id}/build`}>
              Continue building
            </Link>
          </div>
          <div
            className={`card action-card${forManager > 0 ? " action-card-warn" : ""}${
              forManager === 0 && totalQuestions > 0 ? " action-card-ready" : ""
            }`}
          >
            <h2 style={{ marginTop: 0 }}>
              {forManager === 0 && totalQuestions > 0 ? (
                <span className="ready-title" style={{ fontSize: "1.05rem" }}>
                  &#10003; Ready for the dev team
                </span>
              ) : openQuestions.length ? (
                `${openQuestions.length} open question${openQuestions.length === 1 ? "" : "s"}`
              ) : (
                "No open questions"
              )}
            </h2>
            <p className="muted">
              {openQuestions.length === 0 &&
                (totalQuestions > 0
                  ? `All ${totalQuestions} answered - nothing is waiting.`
                  : "Nothing is waiting on an answer.")}
              {openQuestions.length > 0 && forManager > 0 && (
                <>
                  <strong>{forManager} for you</strong>
                  {forDev > 0 && <> - {forDev} flagged for the dev team to decide</>}
                  .
                </>
              )}
              {openQuestions.length > 0 && forManager === 0 && (
                <>
                  Every question for you is answered. {forDev} implementation
                  detail{forDev === 1 ? "" : "s"} ride{forDev === 1 ? "s" : ""}{" "}
                  along for the dev team to settle during review - nothing is
                  waiting on you.
                </>
              )}
            </p>
            {managerTotal > 0 && (
              <>
                <p className="progress-label">
                  Your questions - {plan.resolvedQuestions} of {managerTotal}{" "}
                  answered
                </p>
                <div className="progress">
                  <div
                    className={`progress-bar${forManager > 0 ? " striped" : ""}`}
                    style={{ width: `${managerPct}%` }}
                  />
                </div>
              </>
            )}
            {devTotal > 0 && (
              <>
                <p className="progress-label">
                  Dev team&apos;s questions - {plan.resolvedDevQuestions} of{" "}
                  {devTotal} settled
                </p>
                <div className="progress">
                  <div
                    className={`progress-bar progress-bar-dev${forDev > 0 ? " striped" : ""}`}
                    style={{ width: `${devPct}%`, minWidth: devPct === 0 ? 0 : undefined }}
                  />
                </div>
              </>
            )}
            {totalQuestions > 0 && <div style={{ height: "0.6rem" }} />}
            {forManager > 0 ? (
              <Link className="button-secondary" href={`/plans/${plan.id}/build`}>
                Continue answering questions
              </Link>
            ) : (
              totalQuestions > 0 && <SubmitPlanButton planId={plan.id} compact />
            )}
          </div>
        </div>
      )}

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

      {phaseRows.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Token usage across the lifecycle</h2>
          <p className="muted">
            The full scope from idea to shipped: in-app planning bills the API;
            dev review and build run in Claude Code on the team&apos;s Claude
            plan, so their tokens count but cost nothing extra.
          </p>
          <table>
            <thead>
              <tr>
                <th>Phase</th>
                <th style={{ textAlign: "right" }}>Turns</th>
                <th style={{ textAlign: "right" }}>Input</th>
                <th style={{ textAlign: "right" }}>Output</th>
                <th style={{ textAlign: "right" }}>Cache read</th>
                <th style={{ textAlign: "right" }}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {phaseRows.map((p) => {
                const cost = p.sum.api ? estimateCostUsd(p.sum) : null;
                return (
                  <tr key={p.kind}>
                    <td>{p.label}</td>
                    <td style={{ textAlign: "right" }}>{p.sum.turns}</td>
                    <td style={{ textAlign: "right" }}>
                      {(p.sum.tokensIn + p.sum.tokensCacheWrite).toLocaleString()}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {p.sum.tokensOut.toLocaleString()}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {p.sum.tokensCacheRead.toLocaleString()}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {p.sum.api
                        ? cost !== null
                          ? formatUsd(cost)
                          : "-"
                        : "$0 - Claude plan"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {planSession && (planSession.tokensIn > 0 || planSession.tokensOut > 0) && (
        <p className="muted" style={{ fontSize: "0.78rem" }}>
          Planning session: {Math.floor(turnCount / 2)} exchanges -{" "}
          {(planSession.tokensIn + planSession.tokensCacheWrite).toLocaleString()}{" "}
          input / {planSession.tokensOut.toLocaleString()} output /{" "}
          {planSession.tokensCacheRead.toLocaleString()} cache-read tokens
          {(() => {
            const cost = estimateCostUsd(planSession);
            return cost !== null ? ` (~${formatUsd(cost)})` : "";
          })()}
          . The full cost of planning this, on record.
        </p>
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
