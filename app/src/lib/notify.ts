import { createTransport } from "nodemailer";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { appBaseUrl, slackConfigured, sendSlackDm } from "@/lib/slack";

/**
 * Plan-event nudges through every configured channel - Slack DM (via the
 * capture bot, matched by the user's Slack email) and email (the same SMTP
 * that delivers magic links). Both best-effort: an unconfigured or failing
 * channel never blocks the action that triggered the nudge.
 */

async function slackIdByEmail(email: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` } }
    );
    const data = (await res.json()) as { ok: boolean; user?: { id: string } };
    return data.ok ? (data.user?.id ?? null) : null;
  } catch {
    return null;
  }
}

async function emailUser(to: string, subject: string, text: string) {
  if (!process.env.EMAIL_SERVER_HOST) return;
  const port = Number(process.env.EMAIL_SERVER_PORT ?? 587);
  const transport = createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  });
  await transport.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
  });
}

function isRealEmail(email: string): boolean {
  return email.includes("@") && !email.endsWith(".local");
}

/**
 * A department's effective developer: the assigned one, or - when the company
 * has exactly one developer - that person automatically. Null means "no single
 * developer": nudges fan out to all developers instead.
 */
export async function effectiveDeveloper(departmentId: string) {
  const dept = await db.query.departments.findFirst({
    where: (d, { eq }) => eq(d.id, departmentId),
  });
  if (dept?.developerId) {
    const assigned = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, dept.developerId!),
    });
    if (assigned) return assigned;
  }
  const devs = (
    await db.query.users.findMany({
      where: inArray(schema.users.role, ["developer", "admin"]),
    })
  ).filter((d) => isRealEmail(d.email));
  return devs.length === 1 ? devs[0] : null;
}

/** All developers with real emails - the fan-out fallback. */
export async function allDevelopers() {
  return (
    await db.query.users.findMany({
      where: inArray(schema.users.role, ["developer", "admin"]),
    })
  ).filter((d) => isRealEmail(d.email));
}

/** Send a nudge to specific emails over every configured channel. */
export async function notifyEmails(
  emails: string[],
  subject: string,
  text: string
) {
  await Promise.allSettled(
    emails.filter(isRealEmail).map((e) => notifyOne(e, subject, text))
  );
}

async function notifyOne(email: string, subject: string, text: string) {
  const jobs: Promise<unknown>[] = [];
  if (slackConfigured()) {
    jobs.push(
      slackIdByEmail(email).then((id) =>
        id ? sendSlackDm(id, text) : undefined
      )
    );
  }
  jobs.push(emailUser(email, subject, text));
  await Promise.allSettled(jobs);
}

/**
 * Notify everyone involved in a plan (author + prior thread participants),
 * minus the person who acted.
 */
export async function notifyPlanEvent(opts: {
  planId: string;
  planTitle: string;
  actorId: string;
  actorName: string;
  event: string; // e.g. 'replied in the review thread' / 'set status to approved'
  preview?: string;
}) {
  try {
    const [plan, messages] = await Promise.all([
      db.query.plans.findFirst({
        where: (p, { eq }) => eq(p.id, opts.planId),
      }),
      db.query.planMessages.findMany({
        where: (m, { eq }) => eq(m.planId, opts.planId),
      }),
    ]);
    if (!plan) return;

    const dev = await effectiveDeveloper(plan.departmentId);
    const recipientIds = [
      ...new Set([
        plan.authorId,
        ...(dev ? [dev.id] : []),
        ...messages.map((m) => m.authorId),
      ]),
    ].filter((id) => id !== opts.actorId);
    if (!recipientIds.length) return;

    const recipients = await db.query.users.findMany({
      where: inArray(schema.users.id, recipientIds),
    });

    const base = appBaseUrl();
    const link = base ? `${base}/plans/${opts.planId}` : "";
    const subject = `[Forward Deploy] ${opts.actorName} ${opts.event}: ${opts.planTitle}`;
    const text = [
      `${opts.actorName} ${opts.event} on "${opts.planTitle}".`,
      opts.preview ? `\n> ${opts.preview.slice(0, 280)}` : "",
      link ? `\n${link}` : "",
    ].join("");

    await Promise.allSettled(
      recipients
        .filter((r) => isRealEmail(r.email))
        .map((r) => notifyOne(r.email, subject, text))
    );
  } catch {
    // Nudges are strictly best-effort.
  }
}
