import { and, count, eq, inArray, sql } from "drizzle-orm"

import { submissions, submissionTestcaseQueue } from "@easyshell/db/schema"

import { db } from "@/db"

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Queued or running testcases one user may have at once. */
export const MAX_PENDING_TESTCASES = 20

/**
 * Runs `fn` in a transaction holding a per-user advisory lock, so a
 * count-then-insert limit holds when the same user sends requests in parallel.
 */
export async function withUserLock<T>(
  userId: string,
  scope: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`${scope}:${userId}`}))`,
    )
    return fn(tx)
  })
}

export async function countPendingTestcases(
  userId: string,
  tx: Tx | typeof db = db,
): Promise<number> {
  return (
    await tx
      .select({ pending: count() })
      .from(submissionTestcaseQueue)
      .innerJoin(
        submissions,
        eq(submissions.id, submissionTestcaseQueue.submissionId),
      )
      .where(
        and(
          eq(submissions.userId, userId),
          inArray(submissionTestcaseQueue.status, ["pending", "running"]),
        ),
      )
  )[0]!.pending
}
