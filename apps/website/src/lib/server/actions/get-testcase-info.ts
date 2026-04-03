"use server"

import { and, eq } from "drizzle-orm"

import { submissions, submissionTestcases } from "@easyshell/db/schema"
import { isStandardProblem } from "@easyshell/problems/schema"

import { db } from "@/db"
import { getProblemInfo, getProblemSlugFromId } from "@/lib/server/problems"

import { getSubmissionInfo } from "./get-submission-info"

export async function getTestcaseInfo({
  submissionId,
  testcaseId,
}: {
  submissionId: number
  testcaseId: number
}) {
  const _dataFromDb = await db
    .select({
      input: submissions.input,
      stdout: submissionTestcases.stdout,
      stderr: submissionTestcases.stderr,
      exitCode: submissionTestcases.exitCode,
      fs: submissionTestcases.fs,
      startedAt: submissionTestcases.startedAt,
      finishedAt: submissionTestcases.finishedAt,
      passed: submissionTestcases.passed,
    })
    .from(submissionTestcases)
    .where(
      and(
        eq(submissionTestcases.submissionId, submissionId),
        eq(submissionTestcases.testcaseId, testcaseId),
      ),
    )
    .limit(1)
    .innerJoin(
      submissions,
      eq(submissions.id, submissionTestcases.submissionId),
    )

  if (_dataFromDb.length === 0) {
    throw new Error("Testcase not found")
  }

  const dataFromDb = _dataFromDb[0]!

  const submission = await getSubmissionInfo({ submissionId })

  const problemSlug = await getProblemSlugFromId(
    submission.submission.problemId,
  )

  const problem = await getProblemInfo(problemSlug)

  // Live-environment problems: return check output directly
  // No expected_stdout/stderr/fs comparison -- the stdout IS the check.sh output
  if (!isStandardProblem(problem)) {
    return {
      input: dataFromDb.input,
      stdout: dataFromDb.stdout,
      stderr: dataFromDb.stderr,
      exitCode: dataFromDb.exitCode,
      fs: dataFromDb.fs,
      passed: dataFromDb.passed,
      // Signal to the UI that this is a live-env check output
      isLiveEnvironment: true as const,
    }
  }

  // Standard problem: match against expected values from config
  const testcase = problem.testcases.find((t) => t.id === testcaseId)
  if (!testcase)
    throw new Error("CRITITCAL: Testcase not found (This should not happen)")

  const testcaseInfo = {
    input: dataFromDb.input,
    stdout: dataFromDb.stdout,
    stderr: dataFromDb.stderr,
    exitCode: dataFromDb.exitCode,
    fs: dataFromDb.fs,
    passed: dataFromDb.passed,
    expected_stdout: testcase.expected_stdout,
    expected_stderr: testcase.expected_stderr,
    expected_exit_code: testcase.expected_exit_code,
    expected_fs: testcase.expected_fs,
    isLiveEnvironment: false as const,
  }

  return testcaseInfo
}
