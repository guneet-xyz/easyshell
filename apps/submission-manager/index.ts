import { db } from "@easyshell/db"
import {
  submissionTestcaseQueue,
  submissionTestcases,
  submissions,
} from "@easyshell/db/schema"
import { env } from "@easyshell/env"
import { sleep } from "@easyshell/utils"

import { getProblemSlugFromId } from "./problems"
import { WORKING_DIR, runSubmissionAndGetOutput } from "./utils"

import { and, eq, sql } from "drizzle-orm"
import { mkdir } from "fs/promises"

if (env.APP !== "submission-manager")
  throw new Error(
    "The APP environment variable must be set to 'submission-manager'",
  )

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

async function processQueueItem(
  item: NonNullable<Awaited<ReturnType<typeof getQueueItem>>>,
) {
  console.log("Processing queue item", item)
  const problemId = (
    await db
      .select({ problemId: submissions.problemId })
      .from(submissions)
      .where(eq(submissions.id, item.submissionId))
      .limit(1)
  )[0]?.problemId
  if (!problemId) throw new Error("Submission not found")

  const problemSlug = await getProblemSlugFromId(problemId)

  const { startedAt, finishedAt, output, passed } =
    await runSubmissionAndGetOutput({
      problemSlug,
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

async function init() {
  await mkdir(`${WORKING_DIR}/inputs`, { recursive: true })
  await mkdir(`${WORKING_DIR}/outputs`, { recursive: true })
}

async function loop() {
  while (true) {
    const item = await getQueueItem()
    if (!item) {
      await sleep(1000)
      continue
    }
    processQueueItem(item)
  }
}

async function main() {
  await init()
  await loop()
}

process.on("SIGINT", () => {
  console.log("Received SIGINT signal. Performing graceful shutdown...")
  process.exit(0)
})

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
