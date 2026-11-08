import crypto from "node:crypto"
import { and, asc, eq, sql } from "drizzle-orm"

import { submissions, submissionTestcaseQueue } from "@easyshell/db/schema"
import { createLogger } from "@easyshell/logger"
import { sleep } from "@easyshell/utils"

import { db } from "../db"
import { dispatch } from "../services/dispatcher"
import { generateContainerName } from "../services/job-name"
import { insertExecutionJob, UNASSIGNED_RUNNER_ID } from "../services/jobs"
import { getProblemSlugFromId } from "../services/problems"

const log = createLogger("coordinator:queue-poller")

export type ClaimedQueueItem = {
  jobId: string
  containerName: string
  submissionId: number
  testcaseId: number
  input: string
  image: string
}

/**
 * Atomically claims the next `pending` queue row.
 *
 * Ports the CTE-based SELECT-then-UPDATE pattern from
 * `apps/submission-manager/index.ts:17-50`, extended for the new audit
 * columns added in T2: `attempts++`, `claimed_at`, `claimed_by`,
 * `updated_at`.
 *
 * Returns `null` when no `pending` row exists. On success returns the
 * details needed to dispatch a job to a runner (T14 will wire the real
 * dispatch — for now we only insert an `execution_job` row with a
 * placeholder `runner_id`).
 */
export async function claimNextQueueItem(): Promise<ClaimedQueueItem | null> {
  const jobId = crypto.randomUUID()
  const containerName = generateContainerName()
  const now = new Date()

  // CTE: pick a single `pending` row (LIMIT 1) and atomically flip it to
  // `running` in the same statement so two pollers racing to claim the same
  // row will see only one winner — same shape as submission-manager.
  const item = db.$with("item").as(
    db
      .select({
        submissionId: submissionTestcaseQueue.submissionId,
        testcaseId: submissionTestcaseQueue.testcaseId,
      })
      .from(submissionTestcaseQueue)
      .where(eq(submissionTestcaseQueue.status, "pending"))
      // Least recently touched first: a row put back after a failed dispatch
      // goes behind the others instead of being reclaimed immediately.
      .orderBy(asc(submissionTestcaseQueue.updatedAt))
      .limit(1),
  )

  const updated = (
    await db
      .with(item)
      .update(submissionTestcaseQueue)
      .set({
        status: "running",
        attempts: sql`${submissionTestcaseQueue.attempts} + 1`,
        claimedAt: now,
        claimedBy: jobId,
        updatedAt: now,
      })
      .where(
        and(
          eq(
            submissionTestcaseQueue.submissionId,
            sql`(select ${item.submissionId} from ${item})`,
          ),
          eq(
            submissionTestcaseQueue.testcaseId,
            sql`(select ${item.testcaseId} from ${item})`,
          ),
        ),
      )
      .returning({
        submissionId: submissionTestcaseQueue.submissionId,
        testcaseId: submissionTestcaseQueue.testcaseId,
        attempts: submissionTestcaseQueue.attempts,
      })
  )[0]

  if (!updated) return null

  try {
    return await resolveClaim(jobId, containerName, updated)
  } catch (err: unknown) {
    // Never leave the row `running` with no job, where no sweeper finds it.
    // A missing submission or problem is permanent: fail the row. Anything
    // else (e.g. a dropped database connection) puts it back in the queue.
    const message = err instanceof Error ? err.message : String(err)
    if (!/not found/i.test(message)) {
      await revertQueueItem(updated.submissionId, updated.testcaseId, message)
      throw err
    }
    await db
      .update(submissionTestcaseQueue)
      .set({
        status: "failed",
        lastError: message,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(submissionTestcaseQueue.submissionId, updated.submissionId),
          eq(submissionTestcaseQueue.testcaseId, updated.testcaseId),
        ),
      )
    throw err
  }
}

async function resolveClaim(
  jobId: string,
  containerName: string,
  updated: { submissionId: number; testcaseId: number },
): Promise<ClaimedQueueItem> {
  const submission = (
    await db
      .select({
        input: submissions.input,
        problemId: submissions.problemId,
      })
      .from(submissions)
      .where(eq(submissions.id, updated.submissionId))
      .limit(1)
  )[0]

  if (!submission) {
    throw new Error(`Submission ${updated.submissionId} not found`)
  }

  const problemSlug = await getProblemSlugFromId(submission.problemId)
  const image = `easyshell-${problemSlug}-${updated.testcaseId}`

  return {
    jobId,
    containerName,
    submissionId: updated.submissionId,
    testcaseId: updated.testcaseId,
    input: submission.input,
    image,
  }
}

/**
 * Reverts a claimed queue row back to `pending` so another poller can pick
 * it up. Called when post-claim processing (job insert / dispatch) throws.
 *
 * Also rolls back the `attempts` counter that `claimNextQueueItem`
 * incremented — clamped at 0 via `GREATEST(...)` — and records the
 * triggering error in `last_error`.
 */
export async function revertQueueItem(
  submissionId: number,
  testcaseId: number,
  errorMessage: string,
): Promise<void> {
  await db
    .update(submissionTestcaseQueue)
    .set({
      status: "pending",
      lastError: errorMessage,
      updatedAt: new Date(),
      claimedAt: null,
      claimedBy: null,
      attempts: sql`GREATEST(${submissionTestcaseQueue.attempts} - 1, 0)`,
    })
    .where(
      and(
        eq(submissionTestcaseQueue.submissionId, submissionId),
        eq(submissionTestcaseQueue.testcaseId, testcaseId),
      ),
    )
}

/**
 * Records an `execution_job` row for the claimed item and logs success.
 *
 * The `runner_id` column is set to the sentinel `"unassigned"` (a
 * deregistered runner row, see migration 0005); the
 * dispatcher updates it to the real runner id once `runner.jobs.accept`
 * succeeds. `execution_job.runner_id` is `varchar(64) NOT NULL` with a
 * FK to `runner.id`, so the sentinel keeps the column non-null without
 * forcing a schema change.
 *
 * The submission script is stashed in `execution_job.result.input` for
 * the dispatcher to read back — see `services/jobs.ts` for the
 * rationale.
 *
 * On failure we revert the queue row so another poller (or the same one
 * on its next tick) can try again.
 */
export async function processClaimedItem(
  item: ClaimedQueueItem,
): Promise<boolean> {
  try {
    await db.transaction(async (tx) => {
      await insertExecutionJob(tx, {
        id: item.jobId,
        containerName: item.containerName,
        runnerId: UNASSIGNED_RUNNER_ID,
        mode: "submission",
        image: item.image,
        submissionId: item.submissionId,
        testcaseId: item.testcaseId,
        attempt: 1,
        result: { input: item.input },
      })
    })

    log.info(
      {
        job_id: item.jobId,
        submission_id: item.submissionId,
        testcase_id: item.testcaseId,
        image: item.image,
        container_name: item.containerName,
      },
      "queue.claim.success",
    )

    return await dispatch(item.jobId)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    log.error(
      {
        submission_id: item.submissionId,
        testcase_id: item.testcaseId,
        job_id: item.jobId,
        error: message,
      },
      "queue.claim.process-failed",
    )
    await revertQueueItem(item.submissionId, item.testcaseId, message)
    return false
  }
}

const RETRY_DELAY_MIN_MS = 1000
const RETRY_DELAY_MAX_MS = 5000

/**
 * Pause before the next claim after `failures` consecutive items were not
 * accepted (no runner, runner at capacity, insert or dispatch error). Those
 * rows go straight back to `pending`, so without a pause the poller would
 * reclaim them in a tight loop.
 */
export function retryDelayMs(failures: number): number {
  if (failures <= 0) return 0
  return Math.min(RETRY_DELAY_MAX_MS, RETRY_DELAY_MIN_MS * 2 ** (failures - 1))
}

/**
 * Main poll loop. Mirrors `submission-manager/index.ts:116-140`: claim →
 * dispatch (async) → immediately re-poll. Sleeps 1s when the queue was
 * empty or the claim itself threw, and backs off (see `retryDelayMs`) while
 * claimed items are not being accepted.
 *
 * Returns `Promise<never>`; the caller is expected to keep the process
 * alive (this is invoked from a long-running coordinator worker, not a
 * request handler).
 */
export async function startQueuePoller(): Promise<never> {
  log.info("queue-poller starting")
  let consecutiveFailures = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const delay = retryDelayMs(consecutiveFailures)
    if (delay > 0) await sleep(delay)
    try {
      const item = await claimNextQueueItem()
      if (!item) {
        await sleep(1000)
        continue
      }
      // Fire-and-forget: re-poll immediately so a single slow job does
      // not stall queue throughput.
      processClaimedItem(item).then(
        (accepted) => {
          consecutiveFailures = accepted ? 0 : consecutiveFailures + 1
        },
        (err: unknown) => {
          consecutiveFailures++
          log.error(
            {
              error: err instanceof Error ? err.message : String(err),
              job_id: item.jobId,
            },
            "queue.poller.unexpected-error",
          )
        },
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      log.error({ error: message }, "queue.poller.claim-error")
      await sleep(1000)
    }
  }
}
