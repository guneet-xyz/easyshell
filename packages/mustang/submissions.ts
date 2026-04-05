// ============================================================================
// Mustang Submissions — high-level submission management combining API + DB ops.
// ============================================================================
import {
  isLiveEnvironmentProblem,
  isStandardProblem,
  type ProblemInfo,
} from "@easyshell/problems/schema"
import { sleep } from "@easyshell/utils"

import type { MustangClient, StandardOutput } from "./client"

const log = (...args: unknown[]) =>
  console.log("[mustang:submissions]", ...args)
const logError = (...args: unknown[]) =>
  console.error("[mustang:submissions]", ...args)

/**
 * Run a submission against a problem and return the result.
 * Handles both standard and live-environment problems.
 */
export async function runSubmissionAndGetOutput({
  client,
  problemSlug,
  problemInfo,
  testcaseId,
  input,
  workingDir,
  inputFilePath,
  outputFilePath,
}: {
  client: MustangClient
  problemSlug: string
  problemInfo: ProblemInfo
  testcaseId: number
  input: string
  workingDir: string
  inputFilePath: string
  outputFilePath: string
}): Promise<{
  startedAt: Date
  finishedAt: Date
  output: StandardOutput
  passed: boolean
}> {
  if (isLiveEnvironmentProblem(problemInfo)) {
    log(
      `running live-environment submission (problem=${problemSlug}, input=${input.length} chars)`,
    )
    return await runLiveEnvironmentSubmission({
      client,
      problemSlug,
      input,
    })
  }

  if (!isStandardProblem(problemInfo)) {
    throw new Error(`Unknown problem type for: ${problemSlug}`)
  }

  log(
    `running standard submission (problem=${problemSlug}, testcase=${testcaseId}, input=${JSON.stringify(input.slice(0, 100))})`,
  )

  const startedAt = new Date()

  // Create submission container via mustang service
  const image = `easyshell-${problemSlug}-${testcaseId}`
  const { container_name: containerName } = await client.createSubmission({
    image,
    problem: problemSlug,
    testcase: testcaseId,
    type: "standard",
    input_file_path: inputFilePath,
    output_file_path: outputFilePath,
  })

  log(`container created: ${containerName}, polling for completion...`)

  // Poll until the container finishes (standard containers use --rm)
  const maxWaitMs = 120_000 // 2 minutes
  const pollStart = Date.now()
  let pollCount = 0

  while (Date.now() - pollStart < maxWaitMs) {
    pollCount++
    const pollResult = await client.pollSubmission(
      containerName,
      outputFilePath,
    )
    if (pollResult.status === "finished") {
      const finishedAt = new Date()
      const elapsedMs = finishedAt.getTime() - startedAt.getTime()

      if (!pollResult.output) {
        logError(`container finished but returned no output`)
        throw new Error("Standard submission finished but returned no output")
      }

      const output = pollResult.output
      const passed = evaluateStandardTestcase(output, problemInfo, testcaseId)

      log(
        `submission finished in ${elapsedMs}ms after ${pollCount} polls: passed=${passed} exit_code=${output.exit_code} stdout=${JSON.stringify(output.stdout.slice(0, 200))}`,
      )
      return { startedAt, finishedAt, output, passed }
    }

    // Still running, wait before polling again
    await sleep(500)
  }

  logError(
    `container ${containerName} did not finish within 2 minutes (${pollCount} polls)`,
  )
  throw new Error(
    `Submission container ${containerName} did not finish within 2 minutes`,
  )
}

/**
 * Run a live-environment submission.
 * 1. Start a k3s container
 * 2. Wait for readiness
 * 3. Run user input commands
 * 4. Run check.sh and parse score
 * 5. Clean up
 */
async function runLiveEnvironmentSubmission({
  client,
  problemSlug,
  input,
}: {
  client: MustangClient
  problemSlug: string
  input: string
}): Promise<{
  startedAt: Date
  finishedAt: Date
  output: StandardOutput
  passed: boolean
}> {
  const tag = `easyshell-${problemSlug}-1` // sentinel testcaseId=1
  const startedAt = new Date()

  log(`creating k3s container (image=${tag})`)

  // Create k3s submission container
  const { container_name: containerName } = await client.createSubmission({
    image: tag,
    problem: problemSlug,
    testcase: 1,
    type: "k3s",
    memory: "1g",
    cpu: "1.0",
    privileged: true,
    cgroupns: "private",
    tmpfs: ["/run", "/var/run"],
    command: ["-mode", "k3s-session"],
  })

  log(`k3s container created: ${containerName}, waiting for readiness...`)

  try {
    // Wait for readiness (k3s startup + setup.sh)
    const maxWaitMs = 180_000 // 3 minutes
    const waitStart = Date.now()
    let ready = false
    let readyPolls = 0

    while (Date.now() - waitStart < maxWaitMs) {
      readyPolls++
      const readyResult = await client.getSessionReady(containerName)

      if (readyResult.error) {
        logError(`setup failed after ${readyPolls} polls: ${readyResult.error}`)
        const finishedAt = new Date()
        return {
          startedAt,
          finishedAt,
          output: {
            stdout: `Environment setup failed: ${readyResult.error}`,
            stderr: "",
            exit_code: 1,
            fs: {},
          },
          passed: false,
        }
      }

      // Container died before becoming ready
      if (readyResult.exists && !readyResult.running) {
        logError(
          `container stopped before becoming ready after ${readyPolls} polls`,
        )
        const finishedAt = new Date()
        return {
          startedAt,
          finishedAt,
          output: {
            stdout: "Container stopped before becoming ready",
            stderr: "",
            exit_code: 1,
            fs: {},
          },
          passed: false,
        }
      }

      // Container was removed entirely
      if (!readyResult.exists) {
        logError(`container disappeared after ${readyPolls} polls`)
        const finishedAt = new Date()
        return {
          startedAt,
          finishedAt,
          output: {
            stdout: "Container disappeared before becoming ready",
            stderr: "",
            exit_code: 1,
            fs: {},
          },
          passed: false,
        }
      }

      if (readyResult.ready) {
        const elapsedSec = ((Date.now() - waitStart) / 1000).toFixed(1)
        log(`k3s ready after ${elapsedSec}s (${readyPolls} polls)`)
        ready = true
        break
      }

      await sleep(2000)
    }

    if (!ready) {
      logError(
        `k3s did not become ready within 3 minutes (${readyPolls} polls)`,
      )
      const finishedAt = new Date()
      return {
        startedAt,
        finishedAt,
        output: {
          stdout: "Environment did not become ready within 3 minutes",
          stderr: "",
          exit_code: 1,
          fs: {},
        },
        passed: false,
      }
    }

    // Run the user's input commands
    if (input.trim().length > 0) {
      log(`executing user input (${input.length} chars)`)
      try {
        await client.execSession({
          containerName,
          command: input,
          timeoutMs: 60_000,
        })
        log(`user input executed successfully`)
      } catch {
        log(`user input exec threw (non-fatal, check.sh determines pass/fail)`)
      }
    } else {
      log(`no user input to execute`)
    }

    // Run check.sh via pollSubmission (which handles k3s check.sh execution)
    log(`running check.sh via pollSubmission...`)
    const pollResult = await client.pollSubmission(containerName)
    const finishedAt = new Date()

    if (pollResult.status !== "finished" || !pollResult.score) {
      logError(`check did not return a score: ${JSON.stringify(pollResult)}`)
      return {
        startedAt,
        finishedAt,
        output: {
          stdout: "Check did not return a score",
          stderr: "",
          exit_code: 1,
          fs: {},
        },
        passed: false,
      }
    }

    const { score } = pollResult
    const totalMs = finishedAt.getTime() - startedAt.getTime()
    log(
      `live-env submission done in ${totalMs}ms: score=${score.score}/${score.total} passed=${score.passed}`,
    )
    return {
      startedAt,
      finishedAt,
      output: {
        stdout: score.raw_output,
        stderr: "",
        exit_code: score.passed ? 0 : 1,
        fs: {},
      },
      passed: score.passed,
    }
  } finally {
    // Clean up: kill the container
    log(`cleaning up container ${containerName}`)
    try {
      await client.killSession(containerName)
    } catch {
      // Ignore cleanup errors
    }
  }
}

// =============================================================================
// Testcase evaluation
// =============================================================================

/**
 * Evaluate a standard submission output against expected testcase values.
 */
function evaluateStandardTestcase(
  output: StandardOutput,
  problemInfo: ProblemInfo,
  testcaseId: number,
): boolean {
  if (!isStandardProblem(problemInfo)) return false

  const testcase = problemInfo.testcases.find((t) => t.id === testcaseId)
  if (!testcase) throw new Error("Testcase not found")

  let passed = true

  if (passed && testcase.expected_stdout !== undefined) {
    const match =
      output.stdout === testcase.expected_stdout ||
      output.stdout + "\n" === testcase.expected_stdout ||
      output.stdout === testcase.expected_stdout + "\n"
    if (!match) {
      log(
        `stdout mismatch: got ${JSON.stringify(output.stdout.slice(0, 200))}, expected ${JSON.stringify(testcase.expected_stdout.slice(0, 200))}`,
      )
    }
    passed = match
  }

  if (passed && testcase.expected_stderr !== undefined) {
    if (output.stderr !== testcase.expected_stderr) {
      log(
        `stderr mismatch: got ${JSON.stringify(output.stderr.slice(0, 200))}, expected ${JSON.stringify(testcase.expected_stderr.slice(0, 200))}`,
      )
    }
    passed = passed && output.stderr === testcase.expected_stderr
  }

  if (passed && testcase.expected_exit_code !== undefined) {
    if (output.exit_code !== testcase.expected_exit_code) {
      log(
        `exit_code mismatch: got ${output.exit_code}, expected ${testcase.expected_exit_code}`,
      )
    }
    passed = output.exit_code === testcase.expected_exit_code
  }

  if (passed && testcase.expected_fs !== undefined) {
    if (output.fs === undefined) {
      log(
        `fs mismatch: got undefined, expected ${JSON.stringify(testcase.expected_fs)}`,
      )
      passed = false
    } else {
      if (
        Object.keys(output.fs).length !==
        Object.keys(testcase.expected_fs).length
      ) {
        log(
          `fs key count mismatch: got ${Object.keys(output.fs).length}, expected ${Object.keys(testcase.expected_fs).length}`,
        )
        passed = false
      } else {
        for (const [path, expected] of Object.entries(testcase.expected_fs)) {
          const actual = output.fs[path]
          if (actual !== expected) {
            log(
              `fs mismatch at ${path}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
            )
            passed = false
            break
          }
        }
      }
    }
  }

  return passed
}
