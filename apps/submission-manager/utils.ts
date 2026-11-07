import { getProblem } from "@easyshell/data/problems"

import { env } from "./env"

import { execa } from "execa"
import { z } from "zod"

import { mkdir } from "fs"
import { chmod, readFile, rm, stat, writeFile } from "fs/promises"

export const WORKING_DIR = `${env.WORKING_DIR}/submission-manager`

mkdir(`${WORKING_DIR}/inputs`, { recursive: true }, (err) => {
  if (err) throw err
})
mkdir(`${WORKING_DIR}/outputs`, { recursive: true }, (err) => {
  if (err) throw err
})

/** Upper bound for one testcase run, including container start. */
const SUBMISSION_TIMEOUT_MS = 30_000
const MAX_OUTPUT_BYTES = 1024 * 1024

const OutputJsonSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exit_code: z.number(),
  fs: z.record(z.string()),
})

export async function runSubmissionAndGetOutput({
  problemId,
  testcaseId,
  input,
  suffix,
}: {
  problemId: string
  testcaseId: number
  input: string
  suffix: string
}) {
  const problem = getProblem(problemId)

  const containerName = `easyshell-${problemId}-${testcaseId}-${suffix}`

  const inputFileName = `${containerName}.sh`
  const outputFileName = `${containerName}.json`

  const inputFilePath = `${WORKING_DIR}/inputs/${containerName}.sh`
  const outputFilePath = `${WORKING_DIR}/outputs/${containerName}.json`

  const image = `easyshell-${problemId}-${testcaseId}`

  await writeFile(inputFilePath, input)
  await writeFile(outputFilePath, "")
  // Writable by remapped (user-namespaced) root in the testcase container.
  await chmod(outputFilePath, 0o666)

  const startedAt = new Date()

  const inputFilePathForDocker = `${WORKING_DIR}/inputs/${inputFileName}`
  const outputFilePathForDocker = `${WORKING_DIR}/outputs/${outputFileName}`
  const pullPolicy = env.DOCKER_REGISTRY === "" ? undefined : "--pull=always"

  const imageTag =
    env.DOCKER_REGISTRY === ""
      ? image
      : `${env.DOCKER_REGISTRY}/easyshell/${image}`

  const run = execa(
    "docker",
    [
      "run",
      "-q",
      "--rm",
      "--name",
      containerName,
      "-v",
      `${inputFilePathForDocker}:/input.sh`,
      "-v",
      `${outputFilePathForDocker}:/output.json`,
      "--network",
      "none",
      "--pids-limit",
      "256",
      "-m",
      "10m",
      "--cpus",
      "0.1",
      ...[pullPolicy].filter((x) => x !== undefined),
      imageTag,
      "-mode",
      "submission",
    ],
    { timeout: SUBMISSION_TIMEOUT_MS },
  )
  let raw: string
  try {
    try {
      await run
    } catch (error) {
      // On timeout execa kills only the CLI; remove the container as well.
      await execa("docker", ["rm", "-f", containerName]).catch(() => undefined)
      throw error
    }
    // User code can write /output.json itself; bound what is read.
    if ((await stat(outputFilePath)).size > MAX_OUTPUT_BYTES) {
      throw new Error("Submission output too large")
    }
    raw = await readFile(outputFilePath, { encoding: "utf-8" })
  } finally {
    await rm(inputFilePath, { force: true })
    await rm(outputFilePath, { force: true })
  }
  const finishedAt = new Date()

  const output = OutputJsonSchema.parse(JSON.parse(raw))

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
