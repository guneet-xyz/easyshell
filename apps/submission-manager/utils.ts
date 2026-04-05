import { randomBytes } from "crypto"
import { mkdir, writeFile } from "fs/promises"

import type { MustangClient } from "@easyshell/mustang/client"
import { runSubmissionAndGetOutput as _runSubmissionAndGetOutput } from "@easyshell/mustang/submissions"

import { getProblemInfo } from "./problems"

export async function runSubmissionAndGetOutput({
  client,
  problemSlug,
  testcaseId,
  input,
  workingDir,
}: {
  client: MustangClient
  problemSlug: string
  testcaseId: number
  input: string
  workingDir: string
}) {
  const problemInfo = await getProblemInfo(problemSlug)

  // For standard submissions, prepare input/output files on disk
  // (the mustang service will mount these into the container)
  await mkdir(`${workingDir}/inputs`, { recursive: true })
  await mkdir(`${workingDir}/outputs`, { recursive: true })

  // Use a random suffix to avoid file collisions when running parallel submissions
  // for the same problem/testcase
  const suffix = randomBytes(6).toString("hex")
  const inputFilePath = `${workingDir}/inputs/${problemSlug}-${testcaseId}-${suffix}.sh`
  const outputFilePath = `${workingDir}/outputs/${problemSlug}-${testcaseId}-${suffix}.json`

  await writeFile(inputFilePath, input)
  await writeFile(outputFilePath, "")

  return _runSubmissionAndGetOutput({
    client,
    problemSlug,
    problemInfo,
    testcaseId,
    input,
    workingDir,
    inputFilePath,
    outputFilePath,
  })
}
