import { mkdir, readFile, writeFile } from "fs/promises"
import { execa } from "execa"
import { z } from "zod"

import {
  isLiveEnvironmentProblem,
  isStandardProblem,
} from "@easyshell/problems/schema"
import { sleep } from "@easyshell/utils"

import { getProblemInfo } from "./problems"

const OutputJsonSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exit_code: z.number(),
  fs: z.record(z.string()),
})

export async function runSubmissionAndGetOutput({
  problemSlug,
  testcaseId,
  input,
  suffix,
  workingDir,
  dockerRegistry,
}: {
  problemSlug: string
  testcaseId: number
  input: string
  suffix: string
  workingDir: string
  dockerRegistry: string | undefined
}) {
  const problem = await getProblemInfo(problemSlug)

  if (isLiveEnvironmentProblem(problem)) {
    return await runLiveEnvironmentSubmission({
      problemSlug,
      input,
      suffix,
      dockerRegistry,
    })
  }

  if (!isStandardProblem(problem)) {
    throw new Error(`Unknown problem type for: ${problemSlug}`)
  }

  await mkdir(`${workingDir}/inputs`, { recursive: true })
  await mkdir(`${workingDir}/outputs`, { recursive: true })

  const containerName = `easyshell-${problemSlug}-${testcaseId}-${suffix}`

  const inputFileName = `${containerName}.sh`
  const outputFileName = `${containerName}.json`

  const inputFilePath = `${workingDir}/inputs/${containerName}.sh`
  const outputFilePath = `${workingDir}/outputs/${containerName}.json`

  const image = `easyshell-${problemSlug}-${testcaseId}`

  await writeFile(inputFilePath, input)
  await writeFile(outputFilePath, "")

  const startedAt = new Date()

  const inputFilePathForDocker = `${workingDir}/inputs/${inputFileName}`
  const outputFilePathForDocker = `${workingDir}/outputs/${outputFileName}`
  const pullPolicy = !dockerRegistry ? undefined : "--pull=always"

  const imageTag = !dockerRegistry
    ? image
    : `${dockerRegistry}/easyshell/${image}`

  await execa("docker", [
    "run",
    "-q",
    "--rm",
    "--name",
    containerName,
    "-v",
    `${inputFilePathForDocker}:/input.sh`,
    "-v",
    `${outputFilePathForDocker}:/output.json`,
    "-m",
    "10m",
    "--cpus",
    "0.1",
    ...[pullPolicy].filter((x) => x !== undefined),
    imageTag,
    "-mode",
    "submission",
  ])
  const finishedAt = new Date()

  const output = OutputJsonSchema.parse(
    JSON.parse(await readFile(outputFilePath, { encoding: "utf-8" })),
  )

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

// ======================== Live-environment submissions ========================

const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g
const SCORE_REGEX = /Score:\s*(\d+)\/(\d+)/

/**
 * Run a live-environment submission in a fresh, isolated k3s container.
 * 1. Start a privileged k3s container from the problem image
 * 2. Wait for k3s readiness + setup.sh completion
 * 3. Run the user's input commands
 * 4. Run check.sh and parse the score
 * 5. Clean up the container
 */
async function runLiveEnvironmentSubmission({
  problemSlug,
  input,
  suffix,
  dockerRegistry,
}: {
  problemSlug: string
  input: string
  suffix: string
  dockerRegistry: string | undefined
}) {
  const tag = `easyshell-${problemSlug}-1` // sentinel testcaseId=1
  const containerName = `${tag}-${suffix}`
  const image = dockerRegistry ? `${dockerRegistry}/easyshell/${tag}` : tag

  const startedAt = new Date()

  try {
    // Start the k3s container
    const dockerArgs = [
      "run",
      "-d",
      "--name",
      containerName,
      "-m",
      "1g",
      "--memory-swap",
      "1g",
      "--cpus",
      "1.0",
      "--privileged",
      "--cgroupns=private",
      "--tmpfs",
      "/run",
      "--tmpfs",
      "/var/run",
      ...(dockerRegistry ? ["--pull=always"] : []),
      image,
      "-mode",
      "k3s-session",
    ]
    await execa("docker", dockerArgs)

    // Wait for readiness (k3s startup + setup.sh)
    const maxWaitMs = 180_000 // 3 minutes
    const waitStart = Date.now()
    let ready = false

    while (Date.now() - waitStart < maxWaitMs) {
      try {
        const { stdout } = await execa("docker", [
          "exec",
          containerName,
          "cat",
          "/tmp/easyshell/ready",
        ])
        if (stdout.trim() === "ready") {
          ready = true
          break
        }
      } catch {
        // Check for error file
        try {
          const { stdout: errOut } = await execa("docker", [
            "exec",
            containerName,
            "cat",
            "/tmp/easyshell/ready.error",
          ])
          const finishedAt = new Date()
          return {
            startedAt,
            finishedAt,
            output: {
              stdout: `Environment setup failed: ${errOut.trim()}`,
              stderr: "",
              exit_code: 1,
              fs: {} as Record<string, string>,
            },
            passed: false,
          }
        } catch {
          // Neither file exists yet, keep waiting
        }
      }
      await sleep(2000)
    }

    if (!ready) {
      const finishedAt = new Date()
      return {
        startedAt,
        finishedAt,
        output: {
          stdout: "Environment did not become ready within 3 minutes",
          stderr: "",
          exit_code: 1,
          fs: {} as Record<string, string>,
        },
        passed: false,
      }
    }

    // Run the user's input commands
    if (input.trim().length > 0) {
      try {
        await execa(
          "docker",
          [
            "exec",
            "-e",
            "KUBECONFIG=/etc/rancher/k3s/k3s.yaml",
            containerName,
            "sh",
            "-c",
            input,
          ],
          { timeout: 60_000 },
        )
      } catch {
        // Non-zero exit from user commands is not necessarily a submission
        // failure -- check.sh determines pass/fail
      }
    }

    // Run check.sh
    let checkOutput: string
    try {
      const { stdout } = await execa(
        "docker",
        [
          "exec",
          "-e",
          "KUBECONFIG=/etc/rancher/k3s/k3s.yaml",
          containerName,
          "bash",
          "/check.sh",
        ],
        { timeout: 30_000 },
      )
      checkOutput = stdout
    } catch (err: unknown) {
      // check.sh may exit non-zero for partial scores, capture output
      if (
        err &&
        typeof err === "object" &&
        "stdout" in err &&
        typeof err.stdout === "string"
      ) {
        checkOutput = err.stdout
      } else {
        const finishedAt = new Date()
        const message = err instanceof Error ? err.message : String(err)
        return {
          startedAt,
          finishedAt,
          output: {
            stdout: `check.sh failed: ${message}`,
            stderr: "",
            exit_code: 1,
            fs: {} as Record<string, string>,
          },
          passed: false,
        }
      }
    }

    const finishedAt = new Date()

    // Strip ANSI codes and parse score
    const cleanOutput = checkOutput.replace(ANSI_REGEX, "")
    const scoreMatch = SCORE_REGEX.exec(cleanOutput)

    let passed = false
    if (scoreMatch) {
      const score = parseInt(scoreMatch[1]!, 10)
      const total = parseInt(scoreMatch[2]!, 10)
      passed = score === total && total > 0
    }

    return {
      startedAt,
      finishedAt,
      output: {
        stdout: cleanOutput,
        stderr: "",
        exit_code: passed ? 0 : 1,
        fs: {} as Record<string, string>,
      },
      passed,
    }
  } finally {
    // Clean up: kill and remove the container
    try {
      await execa("docker", ["rm", "-f", containerName])
    } catch {
      // Ignore cleanup errors
    }
  }
}
