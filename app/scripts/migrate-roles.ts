// One-time: collapse the legacy admin/manager roles into developer/user.
import { config } from "dotenv";
config({ path: ".env" });

async function main() {
  const { db, schema } = await import("../src/db");
  const { eq } = await import("drizzle-orm");
  const a = await db
    .update(schema.users)
    .set({ role: "developer" })
    .where(eq(schema.users.role, "admin"))
    .returning();
  const m = await db
    .update(schema.users)
    .set({ role: "user" })
    .where(eq(schema.users.role, "manager"))
    .returning();
  console.log(`admin->developer: ${a.length}, manager->user: ${m.length}`);
  process.exit(0);
}
main();
