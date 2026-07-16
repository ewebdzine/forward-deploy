/**
 * One-off: backfill plans.resolved_questions from the stored transcript for
 * plans created before the counter existed. Heuristic: an assistant turn
 * containing a question that the user then replied to = one answered question.
 * Only touches plans whose counter is still 0.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db";

async function main() {
  const plans = await db.query.plans.findMany();
  for (const plan of plans) {
    if (plan.resolvedQuestions > 0) continue;
    const session = await db.query.planSessions.findFirst({
      where: eq(schema.planSessions.planId, plan.id),
    });
    const turns = ((session?.transcript as { role: string; content: string }[]) ?? []).filter(
      (t) => typeof t.content === "string"
    );
    let answered = 0;
    for (let i = 0; i < turns.length - 1; i++) {
      if (
        turns[i].role === "assistant" &&
        /\?/.test(turns[i].content) &&
        turns[i + 1].role === "user"
      ) {
        answered++;
      }
    }
    if (answered > 0) {
      await db
        .update(schema.plans)
        .set({ resolvedQuestions: answered })
        .where(eq(schema.plans.id, plan.id));
      console.log(`${plan.title}: backfilled ${answered} answered question(s)`);
    } else {
      console.log(`${plan.title}: nothing to backfill`);
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
