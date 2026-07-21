/**
 * Seed the first admin (and optionally departments).
 *
 *   ADMIN_EMAIL=you@company.com ADMIN_NAME="Your Name" npm run seed
 *   npm run seed -- you@company.com "Your Name" "Sales,Support,Accounting"
 *
 * Idempotent: an existing user is promoted to admin, not duplicated.
 */
import "dotenv/config";
import { db, schema } from "../src/db";
import { eq } from "drizzle-orm";

async function main() {
  const [argEmail, argName, argDepartments] = process.argv.slice(2);
  const email = argEmail ?? process.env.ADMIN_EMAIL;
  const name = argName ?? process.env.ADMIN_NAME ?? null;
  if (!email) {
    console.error("Usage: npm run seed -- <admin-email> [name] [dept1,dept2]");
    process.exit(1);
  }

  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });
  if (existing) {
    await db
      .update(schema.users)
      .set({ role: "developer", ...(name ? { name } : {}) })
      .where(eq(schema.users.id, existing.id));
    console.log(`Promoted existing user ${email} to admin.`);
  } else {
    await db.insert(schema.users).values({ email, name, role: "developer" });
    console.log(`Created admin ${email}.`);
  }

  const departments = (argDepartments ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  for (const deptName of departments) {
    const slug = deptName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await db
      .insert(schema.departments)
      .values({ name: deptName, slug })
      .onConflictDoNothing();
    console.log(`Department ready: ${deptName}`);
  }

  console.log("Seed complete. Sign in with the magic link sent to the admin email.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
