import type { MustangClient } from "@easyshell/mustang/client"

/**
 * Run a submission via the mustang service and return results.
 * The service handles file I/O, container lifecycle, and evaluation internally.
 */
export async function runSubmissionAndGetOutput({
  client,
  problemSlug,
  testcaseId,
  input,
}: {
  client: MustangClient
  problemSlug: string
  testcaseId: number
  input: string
}) {
  const result = await client.runSubmission({
    problemSlug,
    testcaseId,
    input,
  })

  return {
    startedAt: new Date(result.started_at),
    finishedAt: new Date(result.finished_at),
    output: result.output,
    passed: result.passed,
  }
}
