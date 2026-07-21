import React from "react";
import Link from "next/link";
import { and, gte, inArray, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { estimateCostUsd, formatUsd, type Usage } from "@/lib/pricing";

export const metadata = { title: "Billing - Forward Deploy" };

const RANGES = [
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "90d", label: "Last 90 days" },
  { key: "year", label: "This year" },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

function rangeBounds(key: RangeKey): { start: Date; end: Date } {
  const now = new Date();
  const end = now;
  if (key === "last-month") {
    return {
      start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
      end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    };
  }
  if (key === "90d") {
    return { start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), end };
  }
  if (key === "year") {
    return { start: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)), end };
  }
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    end,
  };
}

type Bucket = Usage & { turns: number };
const emptyBucket = (): Bucket => ({
  turns: 0,
  tokensIn: 0,
  tokensOut: 0,
  tokensCacheWrite: 0,
  tokensCacheRead: 0,
});
function addRow(b: Bucket, r: typeof schema.usageLog.$inferSelect) {
  b.turns += 1;
  b.tokensIn += r.tokensIn;
  b.tokensOut += r.tokensOut;
  b.tokensCacheWrite += r.tokensCacheWrite;
  b.tokensCacheRead += r.tokensCacheRead;
}
function groupBy(
  rows: (typeof schema.usageLog.$inferSelect)[],
  key: (r: typeof schema.usageLog.$inferSelect) => string
) {
  const map = new Map<string, Bucket>();
  for (const r of rows) {
    const k = key(r);
    if (!map.has(k)) map.set(k, emptyBucket());
    addRow(map.get(k)!, r);
  }
  return map;
}

function BreakdownTable({
  title,
  note,
  rows,
}: {
  title: string;
  note: string;
  rows: { name: string; bucket: Bucket }[];
}) {
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p className="muted">{note}</p>
      {rows.length ? (
        <table>
          <thead>
            <tr>
              <th>{title.replace(/^By /, "")}</th>
              <th style={{ textAlign: "right" }}>Turns</th>
              <th style={{ textAlign: "right" }}>Input</th>
              <th style={{ textAlign: "right" }}>Output</th>
              <th style={{ textAlign: "right" }}>Cache read</th>
              <th style={{ textAlign: "right" }}>Est. cost</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .sort(
                (a, b) =>
                  (estimateCostUsd(b.bucket) ?? b.bucket.tokensOut) -
                  (estimateCostUsd(a.bucket) ?? a.bucket.tokensOut)
              )
              .map((r) => {
                const cost = estimateCostUsd(r.bucket);
                return (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td style={{ textAlign: "right" }}>{r.bucket.turns}</td>
                    <td style={{ textAlign: "right" }}>
                      {(r.bucket.tokensIn + r.bucket.tokensCacheWrite).toLocaleString()}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {r.bucket.tokensOut.toLocaleString()}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {r.bucket.tokensCacheRead.toLocaleString()}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {cost !== null ? formatUsd(cost) : "-"}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          No usage in this range.
        </p>
      )}
    </div>
  );
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rawRange } = await searchParams;
  const range: RangeKey = (RANGES.find((r) => r.key === rawRange)?.key ??
    "this-month") as RangeKey;
  const { start, end } = rangeBounds(range);

  const rows = await db.query.usageLog.findMany({
    where: and(
      gte(schema.usageLog.createdAt, start),
      lt(schema.usageLog.createdAt, end)
    ),
  });

  // Actual billed (Admin API sync), when present for this range.
  const billedRows = await db.query.billedCosts.findMany();
  const billedInRange = billedRows.filter(
    (b) => b.day >= start.toISOString().slice(0, 10) && b.day <= end.toISOString().slice(0, 10)
  );
  const billedTotal = billedInRange.reduce((s, b) => s + b.amountUsd, 0);

  const total = emptyBucket();
  rows.forEach((r) => addRow(total, r));
  const totalCost = estimateCostUsd(total);

  const planRows = rows.filter((r) => r.kind === "plan");
  const sopRows = rows.filter((r) => r.kind === "sop");
  const planCost = estimateCostUsd(
    planRows.reduce((b, r) => (addRow(b, r), b), emptyBucket())
  );
  const sopCost = estimateCostUsd(
    sopRows.reduce((b, r) => (addRow(b, r), b), emptyBucket())
  );

  // Resolve display names.
  const [users, plans, departments] = await Promise.all([
    rows.length
      ? db.query.users.findMany({
          where: inArray(schema.users.id, [...new Set(rows.map((r) => r.userId))]),
        })
      : Promise.resolve([]),
    planRows.length
      ? db.query.plans.findMany({
          where: inArray(schema.plans.id, [...new Set(planRows.map((r) => r.refId))]),
        })
      : Promise.resolve([]),
    db.query.departments.findMany(),
  ]);
  const userName = new Map(users.map((u) => [u.id, u.name ?? u.email]));
  const planTitle = new Map(plans.map((p) => [p.id, p.title]));
  const deptName = new Map(departments.map((d) => [d.slug, d.name]));

  // P&L grouping: department -> users within it. A usage row belongs to the
  // plan's department (kind=plan) or the SOP session's department (kind=sop).
  const deptIdBySlug = new Map(departments.map((d) => [d.slug, d.id]));
  const deptNameById = new Map(departments.map((d) => [d.id, d.name]));
  const planDept = new Map(plans.map((p) => [p.id, p.departmentId]));
  const deptOf = (r: (typeof rows)[number]) =>
    r.kind === "sop"
      ? (deptIdBySlug.get(r.refId) ?? "other")
      : (planDept.get(r.refId) ?? "other");

  const pl = new Map<string, { total: Bucket; users: Map<string, Bucket> }>();
  for (const r of rows) {
    const d = deptOf(r);
    if (!pl.has(d)) pl.set(d, { total: emptyBucket(), users: new Map() });
    const entry = pl.get(d)!;
    addRow(entry.total, r);
    if (!entry.users.has(r.userId)) entry.users.set(r.userId, emptyBucket());
    addRow(entry.users.get(r.userId)!, r);
  }
  const plSections = [...pl]
    .map(([deptId, entry]) => ({
      name: deptNameById.get(deptId) ?? "Other",
      total: entry.total,
      users: [...entry.users]
        .map(([uid, bucket]) => ({ name: userName.get(uid) ?? uid, bucket }))
        .sort(
          (a, b) =>
            (estimateCostUsd(b.bucket) ?? b.bucket.tokensOut) -
            (estimateCostUsd(a.bucket) ?? a.bucket.tokensOut)
        ),
    }))
    .sort(
      (a, b) =>
        (estimateCostUsd(b.total) ?? b.total.tokensOut) -
        (estimateCostUsd(a.total) ?? a.total.tokensOut)
    );
  const byPlan = [...groupBy(planRows, (r) => r.refId)].map(([id, bucket]) => ({
    name: planTitle.get(id) ?? id,
    bucket,
  }));
  const bySop = [...groupBy(sopRows, (r) => r.refId)].map(([slug, bucket]) => ({
    name: deptName.get(slug) ?? slug,
    bucket,
  }));

  // Daily series for the chart (estimated cost, or output tokens when
  // prices are unconfigured).
  const byDay = groupBy(rows, (r) => r.createdAt.toISOString().slice(0, 10));
  const days: { day: string; value: number; label: string }[] = [];
  for (
    let d = new Date(start);
    d < end;
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000)
  ) {
    const key = d.toISOString().slice(0, 10);
    const bucket = byDay.get(key);
    const cost = bucket ? estimateCostUsd(bucket) : null;
    const value = bucket ? (cost ?? bucket.tokensOut) : 0;
    days.push({
      day: key,
      value,
      label: bucket
        ? cost !== null
          ? `${key}: ${formatUsd(cost)} (${bucket.turns} turns)`
          : `${key}: ${bucket.tokensOut.toLocaleString()} output tokens`
        : `${key}: no usage`,
    });
  }
  const maxValue = Math.max(...days.map((d) => d.value), 1);
  const pricesSet = totalCost !== null || rows.length === 0;

  return (
    <>
      <div className="filter-row" style={{ marginBottom: "1rem" }}>
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/admin/billing?range=${r.key}`}
            className={`filter-pill${r.key === range ? " active" : ""}`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Estimated Claude cost</span>
          <span className="stat-value">
            {totalCost !== null ? formatUsd(totalCost) : "-"}
          </span>
          <span className="stat-sub">
            {total.turns} AI turn{total.turns === 1 ? "" : "s"} in range
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Plans vs SOPs</span>
          <span className="stat-value" style={{ fontSize: "1.35rem" }}>
            {planCost !== null ? formatUsd(planCost) : `${planRows.length}t`} /{" "}
            {sopCost !== null ? formatUsd(sopCost) : `${sopRows.length}t`}
          </span>
          <span className="stat-sub">planning / documenting</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Billed (Anthropic)</span>
          <span className="stat-value">
            {billedInRange.length ? formatUsd(billedTotal) : "-"}
          </span>
          <span className="stat-sub">
            {billedInRange.length
              ? `invoice truth, ${billedInRange.length} day${billedInRange.length === 1 ? "" : "s"} synced`
              : "needs ANTHROPIC_ADMIN_KEY"}
          </span>
        </div>
      </div>

      {!pricesSet && (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Set PRICE_PER_MTOK_IN / PRICE_PER_MTOK_OUT to see dollar estimates -
            showing token counts meanwhile.
          </p>
        </div>
      )}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>
          Daily {totalCost !== null ? "cost" : "usage"}
        </h2>
        <div className="bar-chart" aria-label="Daily Claude usage">
          {days.map((d) => (
            <div
              key={d.day}
              className={`bar${d.value > 0 ? "" : " bar-empty"}`}
              style={{ height: `${Math.max((d.value / maxValue) * 100, 2)}%` }}
              title={d.label}
            />
          ))}
        </div>
        <div className="bar-chart-axis muted">
          <span>{days[0]?.day}</span>
          <span>{days[days.length - 1]?.day}</span>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Cost by department</h2>
        <p className="muted">
          P&amp;L view - each department&apos;s total Claude spend, with the
          people inside it beneath. Plan turns attribute to the plan&apos;s
          department; SOP turns to the department being documented.
        </p>
        {plSections.length ? (
          <table>
            <thead>
              <tr>
                <th>Department / user</th>
                <th style={{ textAlign: "right" }}>Turns</th>
                <th style={{ textAlign: "right" }}>Input</th>
                <th style={{ textAlign: "right" }}>Output</th>
                <th style={{ textAlign: "right" }}>Cache read</th>
                <th style={{ textAlign: "right" }}>Est. cost</th>
              </tr>
            </thead>
            <tbody>
              {plSections.map((s) => {
                const deptCost = estimateCostUsd(s.total);
                return (
                  <React.Fragment key={s.name}>
                    <tr className="pl-dept-row">
                      <td>{s.name}</td>
                      <td style={{ textAlign: "right" }}>{s.total.turns}</td>
                      <td style={{ textAlign: "right" }}>
                        {(s.total.tokensIn + s.total.tokensCacheWrite).toLocaleString()}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {s.total.tokensOut.toLocaleString()}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {s.total.tokensCacheRead.toLocaleString()}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {deptCost !== null ? formatUsd(deptCost) : "-"}
                      </td>
                    </tr>
                    {s.users.map((u) => {
                      const cost = estimateCostUsd(u.bucket);
                      return (
                        <tr key={`${s.name}-${u.name}`}>
                          <td className="pl-user-cell">{u.name}</td>
                          <td style={{ textAlign: "right" }}>{u.bucket.turns}</td>
                          <td style={{ textAlign: "right" }}>
                            {(u.bucket.tokensIn + u.bucket.tokensCacheWrite).toLocaleString()}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {u.bucket.tokensOut.toLocaleString()}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {u.bucket.tokensCacheRead.toLocaleString()}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {cost !== null ? formatUsd(cost) : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
              <tr className="pl-grand-row">
                <td>Total</td>
                <td style={{ textAlign: "right" }}>{total.turns}</td>
                <td style={{ textAlign: "right" }}>
                  {(total.tokensIn + total.tokensCacheWrite).toLocaleString()}
                </td>
                <td style={{ textAlign: "right" }}>
                  {total.tokensOut.toLocaleString()}
                </td>
                <td style={{ textAlign: "right" }}>
                  {total.tokensCacheRead.toLocaleString()}
                </td>
                <td style={{ textAlign: "right" }}>
                  {totalCost !== null ? formatUsd(totalCost) : "-"}
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            No usage in this range.
          </p>
        )}
      </div>
      <BreakdownTable
        title="By plan"
        note="What each plan's interview and codebase exploration cost."
        rows={byPlan}
      />
      <BreakdownTable
        title="By SOP department"
        note="Documenting sessions, grouped by the department they belong to."
        rows={bySop}
      />
    </>
  );
}
