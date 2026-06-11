import { relations, sql } from "drizzle-orm"
import {
  AnyPgColumn,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTableCreator,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core"
import { type AdapterAccount } from "next-auth/adapters"

export function lower(col: AnyPgColumn) {
  return sql`lower(${col})`
}

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `easyshell_${name}`)

export const users = createTable(
  "user",
  {
    id: varchar("id", { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: varchar("name", { length: 255 }),
    username: varchar("username", { length: 255 }),
    email: varchar("email", { length: 255 }).notNull(),
    emailVerified: timestamp("email_verified", {
      mode: "date",
      withTimezone: true,
    }).default(sql`CURRENT_TIMESTAMP`),
    image: varchar("image", { length: 255 }),
    joinedAt: timestamp("joined_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("idx_email").on(t.email),
    uniqueIndex("idx_email_lower").on(lower(t.email)),
    uniqueIndex("idx_username").on(t.username),
    uniqueIndex("idx_username_lower").on(lower(t.username)),
  ],
)

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
}))

export const accounts = createTable(
  "account",
  {
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    type: varchar("type", { length: 255 })
      .$type<AdapterAccount["type"]>()
      .notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("provider_account_id", {
      length: 255,
    }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
    index("account_user_id_idx").on(account.userId),
  ],
)

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}))

export const sessions = createTable(
  "session",
  {
    sessionToken: varchar("session_token", { length: 255 })
      .notNull()
      .primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    expires: timestamp("expires", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (session) => [index("session_user_id_idx").on(session.userId)],
)

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const verificationTokens = createTable(
  "verification_token",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
)

export const terminalSessions = createTable(
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

export const terminalSessionLogs = createTable(
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

export const submissions = createTable("submissions", {
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

export const submissionTestcases = createTable(
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

export const submissionTestcaseQueue = createTable(
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

export const bookmarks = createTable(
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

export const images = createTable("images", {
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
