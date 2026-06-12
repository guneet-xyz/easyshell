import { createSessionManagerClient } from "@easyshell/session-manager-client"

import { env } from "./env"
import { getProblemInfo } from "./problems"

const smClient = createSessionManagerClient({
  url: env.SESSION_MANAGER_URL,
  token: env.SESSION_MANAGER_TOKEN,
})

export async function runSubmissionAndGetOutput({
  problemSlug,
  testcaseId,
  input,
  suffix,
}: {
  problemSlug: string
  testcaseId: number
  input: string
  suffix: string
}) {
  const problem = await getProblemInfo(problemSlug)

  const result = await smClient.runSubmissionAndWait({
    image: `easyshell-${problemSlug}-${testcaseId}`,
    input,
    metadata: {
      submission_id: parseInt(suffix.replace("submission-", ""), 10),
      testcase_id: testcaseId,
      problem_slug: problemSlug,
    },
  })

  if (result.status === "error") {
    throw new Error(`session-manager run failed: ${result.error}`)
  }

  const startedAt = new Date(result.started_at)
  const finishedAt = new Date(result.finished_at)
  const output = {
    stdout: result.stdout,
    stderr: result.stderr,
    exit_code: result.exit_code,
    fs: result.fs ?? {},
  }

  const fs = output.fs

  const testcase = problem.testcases.find((t) => t.id === testcaseId)
  if (!testcase) throw new Error("Testcase not found")

  let passed = true
  if (passed && testcase.expected_stdout !== undefined)
    passed =
      output.stdout === testcase.expected_stdout ||
      output.stdout + "\n" === testcase.expected_stdout ||
      output.stdout === testcase.expected_stdout + "\n"

  if (passed && testcase.expected_stderr !== undefined)
    passed = passed && output.stderr === testcase.expected_stderr

  if (passed && testcase.expected_exit_code !== undefined)
    passed = output.exit_code === testcase.expected_exit_code

  if (passed && testcase.expected_fs !== undefined) {
    if (fs === undefined) {
      passed = false
    } else {
      if (Object.keys(fs).length !== Object.keys(testcase.expected_fs).length) {
        passed = false
      } else {
        for (const [path, expected] of Object.entries(testcase.expected_fs)) {
          const actual = fs[path]
          if (actual !== expected) {
            passed = false
            break
          }
        }
      }
    }
  }

  return {
    startedAt,
    finishedAt,
    output,
    passed,
  }
}
