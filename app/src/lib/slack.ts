import { createHmac, timingSafeEqual } from "crypto";

/** The instance's public URL, for links in bot messages. */
export function appBaseUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return (process.env.AUTH_URL ?? "").replace(/\/$/, "");
}

/** Slack integration is optional: absent env = every helper degrades. */
export function slackConfigured(): boolean {
  return Boolean(
    process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET
  );
}

/**
 * Verify Slack's request signature (v0 scheme): reject forged events and
 * anything older than 5 minutes (replay window).
 */
export function verifySlackSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null
): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret || !timestamp || !signature) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 60 * 5) return false;
  const base = `v0:${timestamp}:${rawBody}`;
  const expected = `v0=${createHmac("sha256", secret).update(base).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function slackApi(
  method: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  });
  return (await res.json()) as Record<string, unknown>;
}

/** The email on the Slack account - the key that matches our invited roster. */
export async function getSlackUserEmail(
  slackUserId: string
): Promise<string | null> {
  const res = await fetch(
    `https://slack.com/api/users.info?user=${encodeURIComponent(slackUserId)}`,
    { headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` } }
  );
  const data = (await res.json()) as {
    ok: boolean;
    user?: { profile?: { email?: string } };
  };
  return data.ok ? (data.user?.profile?.email ?? null) : null;
}

export async function sendSlackDm(
  channel: string,
  text: string
): Promise<void> {
  await slackApi("chat.postMessage", { channel, text });
}
