import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";

export const roleEnum = pgEnum("role", ["admin", "developer", "manager"]);

export const planStatusEnum = pgEnum("plan_status", [
  "draft",
  "submitted",
  "in_review",
  "changes_requested",
  "approved",
  "in_development",
  "shipped",
  "declined",
]);

// ---------- Auth.js tables (Drizzle adapter shape) + our role column ----------

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  role: roleEnum("role").notNull().default("manager"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = pgTable("session", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_token",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// ---------- Departments ----------

export const departments = pgTable("department", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const departmentMembers = pgTable(
  "department_member",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    departmentId: text("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
  },
  (m) => [primaryKey({ columns: [m.userId, m.departmentId] })]
);

// ---------- Plans ----------

// Section content keyed by the plan-guidelines outline
// (problem, currentProcess, proposedSolution, affectedSystems, openQuestions, scopeSignal).
export type PlanSections = Record<string, string>;

export const plans = pgTable("plan", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  departmentId: text("department_id")
    .notNull()
    .references(() => departments.id),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id),
  status: planStatusEnum("status").notNull().default("draft"),
  sections: jsonb("sections").$type<PlanSections>().notNull().default({}),
  // Canon paths + file:line references the plan cites, for pull-plan's reading list.
  citations: jsonb("citations").$type<string[]>().notNull().default([]),
  // Open questions resolved so far, split by audience - the answered side of
  // the progress bars (incremented when update_plan shrinks each audience's
  // share of the open_questions list).
  resolvedQuestions: integer("resolved_questions").notNull().default(0),
  resolvedDevQuestions: integer("resolved_dev_questions").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const planMessages = pgTable("plan_message", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "cascade" }),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const mockups = pgTable("mockup", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "cascade" }),
  caption: text("caption").notNull(),
  // Self-contained HTML document; rendered only inside a sandboxed iframe srcdoc.
  html: text("html").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// The Claude conversation that produced a plan, kept for auditability.
export const planSessions = pgTable("plan_session", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "cascade" }),
  transcript: jsonb("transcript").$type<unknown[]>().notNull().default([]),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// Slack capture inbox: DM the bot a note/brain-dump, finish it in the app.
export const captures = pgTable("capture", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  source: text("source").notNull().default("slack"),
  title: text("title").notNull(),
  // [{ text, ts }] in arrival order.
  transcript: jsonb("transcript")
    .$type<{ text: string; ts: string }[]>()
    .notNull()
    .default([]),
  status: text("status").$type<"open" | "dismissed">().notNull().default("open"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// Post-v1: cross-department pattern detection writes here.
export const insights = pgTable("insight", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  body: text("body").notNull(),
  sourceSops: jsonb("source_sops").$type<string[]>().notNull().default([]),
  dismissed: boolean("dismissed").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// ---------- Relations ----------

export const usersRelations = relations(users, ({ many }) => ({
  departmentMembers: many(departmentMembers),
  plans: many(plans),
}));

export const departmentsRelations = relations(departments, ({ many }) => ({
  members: many(departmentMembers),
  plans: many(plans),
}));

export const departmentMembersRelations = relations(
  departmentMembers,
  ({ one }) => ({
    user: one(users, {
      fields: [departmentMembers.userId],
      references: [users.id],
    }),
    department: one(departments, {
      fields: [departmentMembers.departmentId],
      references: [departments.id],
    }),
  })
);

export const plansRelations = relations(plans, ({ one, many }) => ({
  department: one(departments, {
    fields: [plans.departmentId],
    references: [departments.id],
  }),
  author: one(users, { fields: [plans.authorId], references: [users.id] }),
  messages: many(planMessages),
  mockups: many(mockups),
}));

export const planMessagesRelations = relations(planMessages, ({ one }) => ({
  plan: one(plans, { fields: [planMessages.planId], references: [plans.id] }),
  author: one(users, {
    fields: [planMessages.authorId],
    references: [users.id],
  }),
}));

export const mockupsRelations = relations(mockups, ({ one }) => ({
  plan: one(plans, { fields: [mockups.planId], references: [plans.id] }),
}));
