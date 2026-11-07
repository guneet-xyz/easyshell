import { db } from "@easyshell/db"
import {
  submissionTestcaseQueue,
  submissionTestcases,
  submissions,
} from "@easyshell/db/schema"
import { sleep } from "@easyshell/utils"

import { WORKING_DIR, runSubmissionAndGetOutput } from "./utils"

import { and, eq, sql } from "drizzle-orm"

import { mkdir } from "fs/promises"

async function getQueueItem() {
  const item = db.$with("item").as(
    db
      .select({
        submissionId: submissionTestcaseQueue.submissionId,
        testcaseId: submissionTestcaseQueue.testcaseId,
      })
      .from(submissionTestcaseQueue)
      .where(eq(submissionTestcaseQueue.status, "pending"))
      .limit(1),
  )

  const updated_item = (
    await db
      .with(item)
      .update(submissionTestcaseQueue)
      .set({ status: "running" })
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
      })
  )[0]

  if (!updated_item) return null

  const input = (
    await db
      .select({ input: submissions.input })
      .from(submissions)
      .where(eq(submissions.id, updated_item.submissionId))
      .limit(1)
  )[0]?.input

  if (!input) throw new Error("Submission not found")

  return {
    ...updated_item,
    input,
  }
}

const MAX_CONCURRENCY = 4

type QueueItem = NonNullable<Awaited<ReturnType<typeof getQueueItem>>>

async function finishQueueItem(item: QueueItem) {
  await db
    .update(submissionTestcaseQueue)
    .set({ status: "finished" })
    .where(
      and(
        eq(submissionTestcaseQueue.submissionId, item.submissionId),
        eq(submissionTestcaseQueue.testcaseId, item.testcaseId),
      ),
    )
}

/** Record a failed result so a crashed or timed-out run never stays "running". */
async function failQueueItem(item: QueueItem, error: unknown) {
  console.error("Queue item failed", item.submissionId, item.testcaseId, error)
  const now = new Date()
  await db
    .insert(submissionTestcases)
    .values({
      submissionId: item.submissionId,
      testcaseId: item.testcaseId,
      stdout: "",
      stderr: "The submission failed or timed out.",
      exitCode: -1,
      startedAt: now,
      finishedAt: now,
      passed: false,
    })
    .onConflictDoNothing()
  await finishQueueItem(item)
}

async function processQueueItem(item: QueueItem) {
  console.log("Processing queue item", item.submissionId, item.testcaseId)
  const problemId = (
    await db
      .select({ problemId: submissions.problemId })
      .from(submissions)
      .where(eq(submissions.id, item.submissionId))
      .limit(1)
  )[0]?.problemId
  if (!problemId) throw new Error("Submission not found")

  const { startedAt, finishedAt, output, passed } =
    await runSubmissionAndGetOutput({
      problemId,
      testcaseId: item.testcaseId,
      input: item.input,
      suffix: `submission-${item.submissionId}`,
    })

  await db.insert(submissionTestcases).values({
    submissionId: item.submissionId,
    testcaseId: item.testcaseId,
    stdout: output.stdout,
    stderr: output.stderr,
    exitCode: output.exit_code,
    fs: output.fs,
    startedAt,
    finishedAt,
    passed,
  })

  await finishQueueItem(item)
}

async function init() {
  await mkdir(`${WORKING_DIR}/inputs`, { recursive: true })
  await mkdir(`${WORKING_DIR}/outputs`, { recursive: true })
}

async function loop() {
  let inFlight = 0
  while (true) {
    if (inFlight >= MAX_CONCURRENCY) {
      await sleep(100)
      continue
    }
    const item = await getQueueItem()
    if (!item) {
      await sleep(1000)
      continue
    }
    inFlight++
    processQueueItem(item)
      .catch((error) => failQueueItem(item, error))
      .catch((error) => console.error("Failed to record failure", error))
      .finally(() => inFlight--)
  }
}

async function main() {
  await init()
  await loop()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
