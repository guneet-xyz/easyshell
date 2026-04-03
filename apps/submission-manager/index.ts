import { and, eq, sql } from "drizzle-orm"

import { createDb } from "@easyshell/db"
import {
  submissions,
  submissionTestcaseQueue,
  submissionTestcases,
} from "@easyshell/db/schema"
import { sleep } from "@easyshell/utils"

import { env } from "./env"
import { getProblemSlugFromId } from "./problems"
import { runSubmissionAndGetOutput } from "./utils"

const db = createDb(env.DATABASE_URL)

const WORKING_DIR = `${env.WORKING_DIR}/submission-manager`

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

  if (input === undefined || input === null)
    throw new Error("Submission not found")

  return {
    ...updated_item,
    input,
  }
}

async function processQueueItem(
  item: NonNullable<Awaited<ReturnType<typeof getQueueItem>>>,
) {
  console.log("Processing queue item", item)
  try {
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
        workingDir: WORKING_DIR,
        dockerRegistry: env.DOCKER_REGISTRY,
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
  } catch (error) {
    console.error(
      `Failed to process queue item (submission=${item.submissionId}, testcase=${item.testcaseId}):`,
      error,
    )

    // Store the error as a failed result so the submission doesn't hang
    const message = error instanceof Error ? error.message : String(error)
    const now = new Date()

    try {
      await db.insert(submissionTestcases).values({
        submissionId: item.submissionId,
        testcaseId: item.testcaseId,
        stdout: `Error: ${message}`,
        stderr: "",
        exitCode: 1,
        fs: {},
        startedAt: now,
        finishedAt: now,
        passed: false,
      })
    } catch {
      // Testcase result may already exist if the error was after insert
    }

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
}

async function loop() {
  while (true) {
    const item = await getQueueItem()
    if (!item) {
      await sleep(1000)
      continue
    }
    await processQueueItem(item)
  }
}

async function main() {
  await loop()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
