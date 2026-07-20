import { NextResponse } from "next/server";
import { db, schema } from "@/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type CostBucket = {
  starting_at: string;
  ending_at: string;
  results: { amount?: string | number; currency?: string }[];
};
type CostReport = {
  data: CostBucket[];
  has_more?: boolean;
  next_page?: string | null;
};

/**
 * Daily reconciliation: pull the last 7 days of actual billed cost from
 * Anthropic's Admin API (cost_report; daily buckets, amounts are decimal
 * strings in CENTS) and upsert per-day USD totals. Invoice truth beside the
 * token-ledger estimates. Dormant without ANTHROPIC_ADMIN_KEY (note: the
 * Admin API requires a Console *organization* account).
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminKey = process.env.ANTHROPIC_ADMIN_KEY;
  if (!adminKey) {
    return NextResponse.json(
      { skipped: "ANTHROPIC_ADMIN_KEY not set - billed-cost sync is off" },
      { status: 200 }
    );
  }

  const now = new Date();
  const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  start.setUTCHours(0, 0, 0, 0);

  const perDayCents = new Map<string, number>();
  let page: string | null = null;
  for (let i = 0; i < 10; i++) {
    const url = new URL("https://api.anthropic.com/v1/organizations/cost_report");
    url.searchParams.set("starting_at", start.toISOString());
    url.searchParams.set("ending_at", now.toISOString());
    url.searchParams.set("bucket_width", "1d");
    if (page) url.searchParams.set("page", page);

    const res = await fetch(url, {
      headers: {
        "x-api-key": adminKey,
        "anthropic-version": "2023-06-01",
        "User-Agent": "ForwardDeploy/0.4 (github.com/ewebdzine/forward-deploy)",
      },
    });
    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: `cost_report ${res.status}`, detail: body.slice(0, 300) },
        { status: 502 }
      );
    }
    const report = (await res.json()) as CostReport;
    for (const bucket of report.data ?? []) {
      const day = bucket.starting_at?.slice(0, 10);
      if (!day) continue;
      const cents = (bucket.results ?? []).reduce(
        (sum, r) => sum + (Number(r.amount) || 0),
        0
      );
      perDayCents.set(day, (perDayCents.get(day) ?? 0) + cents);
    }
    if (!report.has_more || !report.next_page) break;
    page = report.next_page;
  }

  for (const [day, cents] of perDayCents) {
    await db
      .insert(schema.billedCosts)
      .values({ day, amountUsd: cents / 100, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: schema.billedCosts.day,
        set: { amountUsd: cents / 100, updatedAt: new Date() },
      });
  }

  return NextResponse.json({
    synced: Object.fromEntries(
      [...perDayCents].map(([d, c]) => [d, `$${(c / 100).toFixed(2)}`])
    ),
  });
}
