import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  getSlackUserEmail,
  sendSlackDm,
  slackConfigured,
  verifySlackSignature,
} from "@/lib/slack";

export const dynamic = "force-dynamic";

/** Start a new capture when the last message was this long ago. */
const NEW_CAPTURE_GAP_MS = 30 * 60 * 1000;

type SlackEvent = {
  type: string;
  challenge?: string;
  event?: {
    type: string;
    channel_type?: string;
    subtype?: string;
    bot_id?: string;
    user?: string;
    channel?: string;
    text?: string;
    ts?: string;
  };
};

/**
 * Slack Events API endpoint - the capture DM. DMing the bot IS the opt-in:
 * the sender's Slack email must match the invited users roster; everyone
 * else gets a polite decline and nothing is stored.
 */
export async function POST(req: Request) {
  if (!slackConfigured()) {
    return NextResponse.json({ error: "Slack is not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  if (
    !verifySlackSignature(
      rawBody,
      req.headers.get("x-slack-request-timestamp"),
      req.headers.get("x-slack-signature")
    )
  ) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as SlackEvent;

  // Slack's one-time URL verification handshake.
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  const event = payload.event;
  // Only human-authored DMs to the bot; ignore bot echoes and edits.
  if (
    payload.type !== "event_callback" ||
    event?.type !== "message" ||
    event.channel_type !== "im" ||
    event.subtype ||
    event.bot_id ||
    !event.user ||
    !event.channel ||
    !event.text?.trim()
  ) {
    return NextResponse.json({ ok: true });
  }

  const email = await getSlackUserEmail(event.user);
  const user = email
    ? await db.query.users.findFirst({
        where: eq(schema.users.email, email.toLowerCase()),
      })
    : null;

  if (!user) {
    await sendSlackDm(
      event.channel,
      "I work with Forward Deploy users - no Forward Deploy account matches this Slack email. Ask your admin for an invite."
    );
    return NextResponse.json({ ok: true });
  }

  // Append to the user's open capture (or start a new one after a quiet gap).
  const ts = event.ts ?? String(Date.now() / 1000);
  const open = await db.query.captures.findFirst({
    where: and(
      eq(schema.captures.userId, user.id),
      eq(schema.captures.status, "open")
    ),
    orderBy: (c, { desc }) => desc(c.updatedAt),
  });

  // Events API retries deliveries - dedupe on the message timestamp.
  if (open?.transcript.some((t) => t.ts === ts)) {
    return NextResponse.json({ ok: true });
  }

  const startFresh =
    !open || Date.now() - open.updatedAt.getTime() > NEW_CAPTURE_GAP_MS;

  if (startFresh) {
    await db.insert(schema.captures).values({
      userId: user.id,
      source: "slack",
      title: event.text.slice(0, 80),
      transcript: [{ text: event.text, ts }],
    });
    await sendSlackDm(
      event.channel,
      "Captured - keep talking to add to this note, and finish it in Forward Deploy under Captures whenever you're ready."
    );
  } else {
    await db
      .update(schema.captures)
      .set({
        transcript: [...open.transcript, { text: event.text, ts }],
        updatedAt: new Date(),
      })
      .where(eq(schema.captures.id, open.id));
    // Quiet append - no ack spam on every message.
  }

  return NextResponse.json({ ok: true });
}
