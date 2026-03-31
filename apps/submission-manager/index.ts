import { createDb } from "@easyshell/db"
import {
  submissionTestcaseQueue,
  submissionTestcases,
  submissions,
} from "@easyshell/db/schema"
import { sleep } from "@easyshell/utils"

import { env } from "./env"
import { getProblemSlugFromId } from "./problems"
import { runSubmissionAndGetOutput } from "./utils"

import { and, eq, sql } from "drizzle-orm"
import { mkdir } from "fs/promises"

const DRIZZLE_PROXY_URL = process.env.DRIZZLE_PROXY_URL
const DRIZZLE_PROXY_TOKEN = process.env.DRIZZLE_PROXY_TOKEN
if (!DRIZZLE_PROXY_URL || !DRIZZLE_PROXY_TOKEN)
  throw new Error("DRIZZLE_PROXY_URL and DRIZZLE_PROXY_TOKEN are required")

const db = createDb(DRIZZLE_PROXY_URL, DRIZZLE_PROXY_TOKEN)

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

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
