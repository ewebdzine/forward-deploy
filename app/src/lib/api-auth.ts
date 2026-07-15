import { timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Bearer-token gate for the skills API (/forward-deploy:review-plans and
 * :pull-plan authenticate with FORWARD_DEPLOY_TOKEN). Returns null when
 * authorized, or the error response to send.
 */
export function requireApiToken(req: Request): Response | null {
  const configured = process.env.FORWARD_DEPLOY_TOKEN;
  if (!configured) {
    return Response.json(
      { error: "FORWARD_DEPLOY_TOKEN is not configured on this instance" },
      { status: 503 }
    );
  }
  const header = req.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(presented);
  const b = Buffer.from(configured);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }
  return null;
}

const CLI_EMAIL = "cli@forward-deploy.local";

/**
 * The user a token-authed API message is attributed to: the caller's
 * authorEmail when it matches an invited user, else a find-or-create
 * "Dev team (Claude Code)" system user.
 */
export async function resolveApiAuthor(authorEmail?: string) {
  if (authorEmail) {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, authorEmail.toLowerCase()),
    });
    if (user) return user;
  }
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, CLI_EMAIL),
  });
  if (existing) return existing;
  const [created] = await db
    .insert(schema.users)
    .values({
      email: CLI_EMAIL,
      name: "Dev team (Claude Code)",
      role: "developer",
    })
    .onConflictDoNothing()
    .returning();
  return (
    created ??
    (await db.query.users.findFirst({
      where: eq(schema.users.email, CLI_EMAIL),
    }))!
  );
}
