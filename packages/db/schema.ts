import { InferSelectModel, relations, sql } from "drizzle-orm"
import {
  AnyPgColumn,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core"

export function lower(col: AnyPgColumn) {
  return sql`lower(${col})`
}

// --- Auth

export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
})

export type User = InferSelectModel<typeof users>

export const sessions = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
)

export const accounts = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
)

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
)

export const userRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
}))

export const sessionRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}))

export const accountRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}))

// ---

export const terminalSessions = pgTable(
  "terminal_session",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    problemId: integer("problem_id").notNull(),
    testcaseId: integer("testcase_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
  },
  (ts) => [index("terminal_session_user_id_idx").on(ts.userId)],
)

export const terminalSessionLogs = pgTable(
  "terminal_session_log",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    sessionId: integer("session_id").notNull(),
    stdin: text("stdin").notNull(),
    stdout: text("stdout").notNull(),
    stderr: text("stderr").notNull(),
    startedAt: timestamp("started_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    finishedAt: timestamp("finished_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (tsl) => [
    index("terminal_session_log_session_id_idx").on(tsl.sessionId),
    foreignKey({
      name: "terminal_session_log_session_id_fk",
      columns: [tsl.sessionId],
      foreignColumns: [terminalSessions.id],
    }),
  ],
)

export const submissions = pgTable("submissions", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => users.id),
  problemId: integer("problem_id").notNull(),
  input: text("input").notNull(),
  submittedAt: timestamp("submitted_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const submissionTestcases = pgTable(
  "submission_testcase",
  {
    submissionId: integer("submission_id").notNull(),
    testcaseId: integer("testcase_id").notNull(),
    stdout: text("stdout").notNull(),
    stderr: text("stderr").notNull(),
    exitCode: integer("exit_code").notNull(),
    startedAt: timestamp("started_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    finishedAt: timestamp("finished_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    fs: jsonb("fs").$type<Record<string, string>>(),
    passed: boolean("success").notNull(),
  },
  (submission) => [
    foreignKey({
      name: "submission_testcase_submission_id_fk",
      columns: [submission.submissionId],
      foreignColumns: [submissions.id],
    }),
    primaryKey({
      columns: [submission.submissionId, submission.testcaseId],
    }),
  ],
)
export const queueItemStatus = pgEnum("queue_item_status", [
  "pending",
  "running",
  "finished",
])

export const submissionTestcaseQueue = pgTable(
  "submission_testcase_queue",
  {
    submissionId: integer("submission_id").notNull(),
    testcaseId: integer("testcase_id").notNull(),
    status: queueItemStatus("status").notNull(),
  },
  (item) => [
    foreignKey({
      name: "submission_testcase_queue_fk",
      columns: [item.submissionId],
      foreignColumns: [submissions.id],
    }),
  ],
)

export const bookmarks = pgTable(
  "bookmark",
  {
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    problemId: integer("problem_id").notNull(),
  },
  (bookmark) => [
    index("bookmark_user_id_idx").on(bookmark.userId),
    primaryKey({
      columns: [bookmark.userId, bookmark.problemId],
    }),
  ],
)

export const images = pgTable("images", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  base64: text("base64").notNull(),
  uploadedBy: varchar("uploaded_by", { length: 255 })
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
})
