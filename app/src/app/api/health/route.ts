import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { getSourceControl, repoDescription } from "@/lib/source-control";

export const dynamic = "force-dynamic";

type Check = { status: "ok" | "fail" | "unconfigured"; detail?: string };

async function checkDb(): Promise<Check> {
  if (!process.env.DATABASE_URL) {
    return { status: "unconfigured", detail: "DATABASE_URL" };
  }
  try {
    await db.execute(sql`select 1`);
    return { status: "ok" };
  } catch (e) {
    return { status: "fail", detail: (e as Error).message };
  }
}

async function checkRepo(): Promise<Check> {
  if (!process.env.GITHUB_TOKEN || !process.env.REPO_OWNER || !process.env.REPO_NAME) {
    return { status: "unconfigured", detail: "GITHUB_TOKEN / REPO_OWNER / REPO_NAME" };
  }
  try {
    await getSourceControl().listFiles("");
    return { status: "ok", detail: repoDescription() };
  } catch (e) {
    return { status: "fail", detail: (e as Error).message };
  }
}

async function checkAnthropic(): Promise<Check> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { status: "unconfigured", detail: "ANTHROPIC_API_KEY" };
  }
  try {
    const client = new Anthropic();
    await client.models.list();
    return { status: "ok" };
  } catch (e) {
    return { status: "fail", detail: (e as Error).message };
  }
}

function checkEmail(): Check {
  const missing = ["EMAIL_SERVER_HOST", "EMAIL_FROM"].filter(
    (k) => !process.env[k]
  );
  // Config-level only; sending a test mail is outward-facing and never automatic.
  return missing.length
    ? { status: "unconfigured", detail: missing.join(", ") }
    : { status: "ok" };
}

export async function GET() {
  const [dbCheck, repo, anthropic] = await Promise.all([
    checkDb(),
    checkRepo(),
    checkAnthropic(),
  ]);
  const email = checkEmail();
  const checks = { db: dbCheck, repo, anthropic, email };
  const healthy = Object.values(checks).every((c) => c.status === "ok");

  return NextResponse.json(
    { healthy, checks, version: "0.1.0" },
    { status: healthy ? 200 : 503 }
  );
}
