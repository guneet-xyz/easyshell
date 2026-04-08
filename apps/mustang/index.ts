import { randomBytes } from "node:crypto"
import { readFile, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { serve } from "@hono/node-server"
import { Hono, type Context } from "hono"
import { bearerAuth } from "hono/bearer-auth"
import { streamSSE } from "hono/streaming"

import { createDb } from "@easyshell/db"
import {
  isLiveEnvironmentProblem,
  isStandardProblem,
  type ProblemInfo,
} from "@easyshell/problems/schema"
import { sleep } from "@easyshell/utils"

import {
  claimContainer,
  findContainers,
  getContainerByName,
  insertContainer,
  softDeleteContainer,
} from "./db"
import {
  dockerExec,
  dockerInspect,
  dockerPs,
  dockerRm,
  dockerRun,
  resolveImageTag,
} from "./docker"
import { env } from "./env"
import { getProblemInfo } from "./problems"
import {
  findActiveSession,
  findExpiredSessions,
  getSessionLogs,
  insertSessionLog,
  insertTerminalSession,
  softDeleteSession,
  softDeleteSessions,
  updateSessionContainerName,
} from "./session-db"
import { execBuffered, execStream } from "./socket"
import {
  allowedCgroupNs,
  allowedModes,
  allowedTypes,
  generateContainerName,
  getContainerDir,
  getSubmissionsDir,
  initWorkingDirs,
  mkdirp,
  parseScore,
  validCommandArg,
  validContainerName,
  validFilePath,
  validImageName,
  validProblemSlug,
  validResourceLimit,
  validTmpfsPath,
} from "./utils"

// =============================================================================
// Setup
// =============================================================================

const log = (...args: unknown[]) => console.log("[mustang]", ...args)

const db = createDb(env.DATABASE_URL)

const app = new Hono()

// =============================================================================
// Middleware
// =============================================================================

// Bearer auth on all routes
app.use("*", bearerAuth({ token: env.MUSTANG_TOKEN }))

// Request logging (matching Go's logMiddleware behavior)
app.use("*", async (c, next) => {
  const start = Date.now()

  // Capture body snippet for non-GET methods
  let bodySnippet = ""
  if (c.req.method !== "GET") {
    try {
      const text = await c.req.text()
      bodySnippet = text.trim().replace(/\s+/g, " ")
      if (bodySnippet.length > 512) {
        bodySnippet = bodySnippet.slice(0, 512) + "..."
      }
    } catch {
      // body might not be readable, that's fine
    }
  }

  await next()

  const duration = Date.now() - start
  const durationStr =
    duration < 1
      ? `${duration * 1000}µs`
      : duration < 1000
        ? `${duration}ms`
        : `${(duration / 1000).toFixed(1)}s`

  const query =
    c.req.query() && Object.keys(c.req.query()).length > 0
      ? "?" + new URL(c.req.url).searchParams.toString()
      : ""

  const time = new Date().toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  })

  if (bodySnippet) {
    console.log(
      `[${time}] ${c.req.method} ${c.req.path}${query} ${bodySnippet} -> ${c.res.status} (${durationStr})`,
    )
  } else {
    console.log(
      `[${time}] ${c.req.method} ${c.req.path}${query} -> ${c.res.status} (${durationStr})`,
    )
  }
})

// =============================================================================
// POST /session/create
// =============================================================================

app.post("/session/create", async (c) => {
  const body = await c.req.json()

  const image = body.image as string | undefined
  const problem = body.problem as string | undefined
  const testcase = (body.testcase as number | undefined) ?? 0
  const mode = body.mode as string | undefined
  const type = body.type as string | undefined
  const memory = (body.memory as string | undefined) || "10m"
  const cpu = (body.cpu as string | undefined) || "0.1"
  const privileged = (body.privileged as boolean | undefined) ?? false
  const tmpfs = (body.tmpfs as string[] | undefined) ?? []
  const cgroupns = body.cgroupns as string | undefined
  const command = (body.command as string[] | undefined) ?? []

  // Input validation
  if (!image || !validImageName.test(image)) {
    return c.text("Invalid image name", 400)
  }
  if (!problem || !validProblemSlug.test(problem)) {
    return c.text("Invalid problem slug", 400)
  }
  if (!mode || !allowedModes.has(mode)) {
    return c.text("Invalid mode (must be 'session' or 'submission')", 400)
  }
  if (!type || !allowedTypes.has(type)) {
    return c.text("Invalid type (must be 'standard' or 'k3s')", 400)
  }
  if (!validResourceLimit.test(memory)) {
    return c.text("Invalid memory value", 400)
  }
  if (!validResourceLimit.test(cpu)) {
    return c.text("Invalid cpu value", 400)
  }
  if (cgroupns && !allowedCgroupNs.has(cgroupns)) {
    return c.text("Invalid cgroupns value (must be 'private' or 'host')", 400)
  }
  for (const mount of tmpfs) {
    if (!validTmpfsPath.test(mount)) {
      return c.text("Invalid tmpfs path", 400)
    }
  }
  for (const arg of command) {
    if (arg.startsWith("--")) {
      return c.text("Docker flags are not allowed in command arguments", 400)
    }
    if (!validCommandArg.test(arg)) {
      return c.text("Invalid command argument", 400)
    }
  }

  const containerName = generateContainerName()
  const containerDir = getContainerDir(containerName)
  await mkdirp(containerDir)

  const imageTag = resolveImageTag(image)

  const args: string[] = [
    "-q",
    "-d",
    "--rm",
    "--name",
    containerName,
    "-m",
    memory,
    "--memory-swap",
    memory,
    "--cpus",
    cpu,
    "-v",
    `${containerDir}:/tmp/easyshell`,
    "--label",
    `sh.easyshell.problem=${problem}`,
    "--label",
    `sh.easyshell.testcase=${testcase}`,
    "--label",
    `sh.easyshell.mode=${mode}`,
    "--label",
    `sh.easyshell.type=${type}`,
  ]

  if (env.DOCKER_REGISTRY) {
    args.push("--pull=always")
  }
  if (privileged) {
    args.push("--privileged")
  }
  if (cgroupns) {
    args.push(`--cgroupns=${cgroupns}`)
  }
  for (const mount of tmpfs) {
    args.push("--tmpfs", mount)
  }

  args.push(imageTag)

  if (command.length > 0) {
    args.push(...command)
  } else {
    args.push("-mode", "session")
  }

  log("docker run args:", args.join(" "))

  try {
    await dockerRun(args)
  } catch (err) {
    log("container create failed:", err)
    return c.text(
      `Failed to create container: ${err instanceof Error ? err.message : String(err)}`,
      500,
    )
  }

  // Insert container record into DB
  await insertContainer(db, {
    name: containerName,
    image,
    problem,
    testcase,
    mode,
    type,
    memory,
    cpu,
  })

  log("container created:", containerName)
  return c.json({ container_name: containerName })
})

// =============================================================================
// GET /session/ready
// =============================================================================

app.get("/session/ready", async (c) => {
  const containerName = c.req.query("name")
  if (!containerName || !validContainerName.test(containerName)) {
    return c.text("Invalid or missing container name", 400)
  }

  const resp = { exists: false, running: false, ready: false, error: "" }

  // Check if container exists and get its state
  const stateOutput = await dockerInspect(containerName, "{{.State.Status}}")

  if (stateOutput === null) {
    return c.json(resp)
  }

  resp.exists = true
  resp.running = stateOutput === "running"

  if (!resp.running) {
    return c.json(resp)
  }

  // Check for error file
  const errResult = await dockerExec(containerName, [
    "cat",
    "/tmp/easyshell/ready.error",
  ])
  if (errResult.exitCode === 0) {
    resp.error = errResult.stdout.trim()
    return c.json(resp)
  }

  // Check for ready file
  const readyResult = await dockerExec(containerName, [
    "cat",
    "/tmp/easyshell/ready",
  ])
  if (readyResult.exitCode !== 0) {
    // Neither file exists yet -- still starting up
    return c.json(resp)
  }

  const isReady = readyResult.stdout.trim() === "ready"
  if (!isReady) {
    log(
      `Unexpected ready file content for ${containerName}: ${JSON.stringify(readyResult.stdout)}`,
    )
  }
  resp.ready = isReady

  return c.json(resp)
})

// =============================================================================
// POST /session/exec (buffered)
// =============================================================================

app.post("/session/exec", async (c) => {
  const body = await c.req.json()
  const containerName = body.container_name as string | undefined
  const command = body.command as string | undefined

  if (!containerName || !validContainerName.test(containerName)) {
    return c.text("Invalid container name", 400)
  }
  if (!command) {
    return c.text("Missing command", 400)
  }

  log("Container:", containerName)
  log("Command:", command)

  // Chmod the socket (non-fatal if it fails)
  await dockerExec(containerName, ["chmod", "0777", "/tmp/easyshell/main.sock"])

  const result = await execBuffered(containerName, command)

  if (!result.ok) {
    if (result.statusCode === 423) {
      return c.json(result.error, 423)
    }
    return c.json(result.error, 500)
  }

  log("Command output:", result.body)
  return c.body(result.body, 200)
})

// =============================================================================
// GET /session/exec (SSE stream)
// =============================================================================

app.get("/session/exec", async (c) => {
  const containerName = c.req.query("name")
  const command = c.req.query("command")

  if (!containerName || !validContainerName.test(containerName)) {
    return c.text("Invalid or missing container name", 400)
  }
  if (!command) {
    return c.text("Missing command", 400)
  }

  log(`SSE exec - Container: ${containerName}, Command: ${command}`)

  // Chmod the socket (non-fatal if it fails)
  await dockerExec(containerName, ["chmod", "0777", "/tmp/easyshell/main.sock"])

  return streamSSE(c, async (stream) => {
    await execStream(containerName, command, (eventType, data) => {
      stream.writeSSE({ event: eventType, data }).catch(() => {
        // Client disconnected, ignore
      })
    })
  })
})

// =============================================================================
// POST /session/kill
// =============================================================================

app.post("/session/kill", async (c) => {
  const body = await c.req.json()
  const containerName = body.container_name as string | undefined

  if (!containerName || !validContainerName.test(containerName)) {
    return c.text("Invalid container name", 400)
  }

  log("Removing container:", containerName)

  try {
    await dockerRm(containerName)
  } catch (err) {
    return c.text(
      `Failed: ${err instanceof Error ? err.message : String(err)}`,
      500,
    )
  }

  // Soft-delete container record in DB
  await softDeleteContainer(db, containerName)

  return c.body(null, 200)
})

// =============================================================================
// POST /session/check
// =============================================================================

app.post("/session/check", async (c) => {
  const body = await c.req.json()
  const containerName = body.container_name as string | undefined

  if (!containerName || !validContainerName.test(containerName)) {
    return c.text("Invalid container name", 400)
  }

  log("Running check for container:", containerName)

  const result = await dockerExec(containerName, ["bash", "/check.sh"], {
    KUBECONFIG: "/etc/rancher/k3s/k3s.yaml",
  })

  // check.sh may return non-zero when not all checks pass (partial score).
  // Only treat it as a hard error if there is no output at all.
  if (
    result.exitCode !== 0 &&
    result.stdout.length === 0 &&
    result.stderr.length === 0
  ) {
    log(`Check failed for ${containerName}: exit code ${result.exitCode}`)
    return c.text(`Failed to run check: exit code ${result.exitCode}`, 500)
  }

  const score = parseScore(result.stdout + result.stderr)
  return c.json(score)
})

// =============================================================================
// POST /session/claim
// =============================================================================

app.post("/session/claim", async (c) => {
  const body = await c.req.json()
  const containerName = body.container_name as string | undefined

  if (!containerName || !validContainerName.test(containerName)) {
    return c.text("Invalid container name", 400)
  }

  // Atomic DB claim -- the WHERE clause ensures only unclaimed warm containers
  // can be claimed. This replaces Go's sync.Mutex + file-based claim markers.
  const claimed = await claimContainer(db, containerName)

  if (!claimed) {
    // Fall back to checking why it failed
    const container = await getContainerByName(db, containerName)
    const error = !container
      ? "container not found"
      : container.mode !== "warm"
        ? "container is not a warm instance"
        : "container already claimed"

    log(`Claim failed: ${containerName} - ${error}`)
    return c.json({ claimed: false, error })
  }

  log("Container claimed:", containerName)
  return c.json({ claimed: true })
})

// =============================================================================
// GET /containers/list
// =============================================================================

app.get("/containers/list", async (c) => {
  const filterMode = c.req.query("mode")
  const filterProblem = c.req.query("problem")
  const filterTestcase = c.req.query("testcase")

  // Query containers from DB instead of docker ps
  const containers = await findContainers(db, {
    mode: filterMode,
    problem: filterProblem,
    testcase: filterTestcase ? parseInt(filterTestcase, 10) : undefined,
  })

  // Map DB records to the expected response format (matching Go's response shape)
  const result = containers.map((container) => ({
    name: container.name,
    labels: {
      "sh.easyshell.problem": container.problem,
      "sh.easyshell.testcase": String(container.testcase),
      "sh.easyshell.mode": container.mode,
      "sh.easyshell.type": container.type,
    },
    created_at: container.createdAt.toISOString(),
    status: container.status,
  }))

  return c.json({ containers: result })
})

// =============================================================================
// POST /submission/create
// =============================================================================

app.post("/submission/create", async (c) => {
  const body = await c.req.json()

  const image = body.image as string | undefined
  const problem = body.problem as string | undefined
  const testcase = (body.testcase as number | undefined) ?? 0
  const type = body.type as string | undefined
  const inputFilePath = body.input_file_path as string | undefined
  const outputFilePath = body.output_file_path as string | undefined
  const memory = (body.memory as string | undefined) || "10m"
  const cpu = (body.cpu as string | undefined) || "0.1"
  const privileged = (body.privileged as boolean | undefined) ?? false
  const tmpfs = (body.tmpfs as string[] | undefined) ?? []
  const cgroupns = body.cgroupns as string | undefined
  const command = (body.command as string[] | undefined) ?? []

  // Input validation
  if (!image || !validImageName.test(image)) {
    return c.text("Invalid image name", 400)
  }
  if (!problem || !validProblemSlug.test(problem)) {
    return c.text("Invalid problem slug", 400)
  }
  if (!type || !allowedTypes.has(type)) {
    return c.text("Invalid type (must be 'standard' or 'k3s')", 400)
  }
  if (!validResourceLimit.test(memory)) {
    return c.text("Invalid memory value", 400)
  }
  if (!validResourceLimit.test(cpu)) {
    return c.text("Invalid cpu value", 400)
  }

  // For standard submissions, input and output file paths are required
  if (type === "standard") {
    if (!inputFilePath || !validFilePath.test(inputFilePath)) {
      return c.text("Invalid or missing input_file_path", 400)
    }
    if (!outputFilePath || !validFilePath.test(outputFilePath)) {
      return c.text("Invalid or missing output_file_path", 400)
    }
  }

  if (cgroupns && !allowedCgroupNs.has(cgroupns)) {
    return c.text("Invalid cgroupns value", 400)
  }
  for (const mount of tmpfs) {
    if (!validTmpfsPath.test(mount)) {
      return c.text("Invalid tmpfs path", 400)
    }
  }
  for (const arg of command) {
    if (arg.startsWith("--")) {
      return c.text("Docker flags are not allowed in command arguments", 400)
    }
    if (!validCommandArg.test(arg)) {
      return c.text("Invalid command argument", 400)
    }
  }

  const containerName = generateContainerName()
  const imageTag = resolveImageTag(image)

  let args: string[]

  if (type === "standard") {
    // Standard submission: short-lived container with --rm, mounts input/output
    args = [
      "-q",
      "-d",
      "--rm",
      "--name",
      containerName,
      "-m",
      memory,
      "--memory-swap",
      memory,
      "--cpus",
      cpu,
      "-v",
      `${inputFilePath}:/input.sh`,
      "-v",
      `${outputFilePath}:/output.json`,
      "--label",
      `sh.easyshell.problem=${problem}`,
      "--label",
      `sh.easyshell.testcase=${testcase}`,
      "--label",
      "sh.easyshell.mode=submission",
      "--label",
      `sh.easyshell.type=${type}`,
    ]
  } else {
    // K3s submission: long-running container, needs easyshell volume
    const containerDir = getContainerDir(containerName)
    await mkdirp(containerDir)

    args = [
      "-q",
      "-d",
      "--name",
      containerName,
      "-m",
      memory,
      "--memory-swap",
      memory,
      "--cpus",
      cpu,
      "-v",
      `${containerDir}:/tmp/easyshell`,
      "--label",
      `sh.easyshell.problem=${problem}`,
      "--label",
      `sh.easyshell.testcase=${testcase}`,
      "--label",
      "sh.easyshell.mode=submission",
      "--label",
      `sh.easyshell.type=${type}`,
    ]
  }

  if (env.DOCKER_REGISTRY) {
    args.push("--pull=always")
  }
  if (privileged) {
    args.push("--privileged")
  }
  if (cgroupns) {
    args.push(`--cgroupns=${cgroupns}`)
  }
  for (const mount of tmpfs) {
    args.push("--tmpfs", mount)
  }

  args.push(imageTag)

  if (command.length > 0) {
    args.push(...command)
  } else {
    args.push("-mode", "submission")
  }

  log("submission docker run args:", args.join(" "))

  try {
    await dockerRun(args)
  } catch (err) {
    log("submission create failed:", err)
    return c.text(
      `Failed to create submission container: ${err instanceof Error ? err.message : String(err)}`,
      500,
    )
  }

  // Insert container record into DB
  await insertContainer(db, {
    name: containerName,
    image,
    problem,
    testcase,
    mode: "submission",
    type,
    memory,
    cpu,
  })

  log("submission container created:", containerName)
  return c.json({ container_name: containerName })
})

// =============================================================================
// POST /submission/poll
// =============================================================================

app.post("/submission/poll", async (c) => {
  const body = await c.req.json()
  const containerName = body.container_name as string | undefined
  const outputFilePath = body.output_file_path as string | undefined

  if (!containerName || !validContainerName.test(containerName)) {
    return c.text("Invalid container name", 400)
  }
  if (outputFilePath && !validFilePath.test(outputFilePath)) {
    return c.text("Invalid output_file_path", 400)
  }

  log("Polling submission container:", containerName)

  // Check container type -- first try DB, fall back to docker inspect
  let containerType: string | null = null
  const dbRecord = await getContainerByName(db, containerName)
  if (dbRecord) {
    containerType = dbRecord.type
  } else {
    // Container not in DB (maybe pre-migration) -- try docker inspect
    const typeLabel = await dockerInspect(
      containerName,
      '{{index .Config.Labels "sh.easyshell.type"}}',
    )
    if (typeLabel === null) {
      // Container doesn't exist at all -- for standard (--rm), it may have finished
      if (outputFilePath) {
        try {
          const data = await readFile(outputFilePath, "utf-8")
          if (!data) {
            return c.text("Container not found and output file is empty", 404)
          }
          const output = JSON.parse(data)
          return c.json({ status: "finished", output })
        } catch (err) {
          return c.text(
            `Container not found and no output available: ${err instanceof Error ? err.message : String(err)}`,
            404,
          )
        }
      }
      return c.text("Container not found and no output available", 404)
    }
    containerType = typeLabel
  }

  // Check if container is still running
  const stateOutput = await dockerInspect(containerName, "{{.State.Status}}")
  const isRunning = stateOutput === "running"

  if (containerType === "k3s") {
    if (!isRunning) {
      return c.json({
        status: "finished",
        score: {
          score: 0,
          total: 0,
          percentage: 0,
          passed: false,
          raw_output: "Container exited before check could be performed",
        },
      })
    }

    // Run check.sh
    const result = await dockerExec(containerName, ["bash", "/check.sh"], {
      KUBECONFIG: "/etc/rancher/k3s/k3s.yaml",
    })

    if (
      result.exitCode !== 0 &&
      result.stdout.length === 0 &&
      result.stderr.length === 0
    ) {
      return c.text(`Failed to run check: exit code ${result.exitCode}`, 500)
    }

    const score = parseScore(result.stdout + result.stderr)
    return c.json({ status: "finished", score })
  }

  // Standard submission
  if (isRunning) {
    return c.json({ status: "running" })
  }

  // Standard container finished (removed by --rm) -- read output file
  if (!outputFilePath) {
    return c.text("Container finished but no output_file_path provided", 500)
  }

  try {
    const data = await readFile(outputFilePath, "utf-8")
    if (!data) {
      return c.text("Container finished but output file is empty", 500)
    }
    const output = JSON.parse(data)
    return c.json({ status: "finished", output })
  } catch (err) {
    return c.text(
      `Container finished but output not available: ${err instanceof Error ? err.message : String(err)}`,
      500,
    )
  }
})

// =============================================================================
// POST /terminal-session/get-or-create
// =============================================================================

/**
 * High-level endpoint: get an existing active terminal session or create a new one.
 * Absorbs the logic from packages/mustang/sessions.ts:
 *   getTerminalSession + createTerminalSession + runTerminalSession + tryClaimWarmContainer
 */
app.post("/terminal-session/get-or-create", async (c) => {
  const body = await c.req.json()
  const userId = body.user_id as string | undefined
  const problemId = body.problem_id as number | undefined
  const testcaseId = body.testcase_id as number | undefined
  const problemSlug = body.problem_slug as string | undefined
  const problemType = body.problem_type as string | undefined

  if (!userId) return c.text("Missing user_id", 400)
  if (problemId === undefined) return c.text("Missing problem_id", 400)
  if (testcaseId === undefined) return c.text("Missing testcase_id", 400)
  if (!problemSlug || !validProblemSlug.test(problemSlug))
    return c.text("Invalid problem_slug", 400)
  if (!problemType || !allowedTypes.has(problemType))
    return c.text("Invalid problem_type", 400)

  const isK3s = problemType === "k3s"

  // Check for an existing active session
  const existingSession = await findActiveSession(db, {
    userId,
    problemId,
    testcaseId,
  })

  if (existingSession) {
    // Check if the session has expired
    if (existingSession.expiresAt && existingSession.expiresAt < new Date()) {
      log(
        `get-or-create: session ${existingSession.id} has expired, soft-deleting`,
      )
      await softDeleteSession(db, existingSession.id)

      // Best-effort kill the container
      if (existingSession.containerName) {
        try {
          await dockerRm(existingSession.containerName)
          await softDeleteContainer(db, existingSession.containerName)
        } catch {
          // Container may already be gone
        }
      }
    } else if (existingSession.containerName) {
      // Check container liveness
      const stateOutput = await dockerInspect(
        existingSession.containerName,
        "{{.State.Status}}",
      )
      if (stateOutput !== null && stateOutput === "running") {
        // Session is alive — return it
        log(
          `get-or-create: returning existing session ${existingSession.id} (container=${existingSession.containerName})`,
        )
        const logs = await getSessionLogs(db, existingSession.id)
        return c.json({
          id: existingSession.id,
          container_name: existingSession.containerName,
          created_at: existingSession.createdAt.toISOString(),
          expires_at: existingSession.expiresAt.toISOString(),
          ready: true,
          logs: logs.map((l) => ({
            id: l.id,
            stdin: l.stdin,
            stdout: l.stdout,
            stderr: l.stderr,
            started_at: l.startedAt.toISOString(),
            finished_at: l.finishedAt.toISOString(),
          })),
        })
      }

      // Container is dead — soft-delete
      log(
        `get-or-create: session ${existingSession.id} container is dead, soft-deleting`,
      )
      await softDeleteSession(db, existingSession.id)
    } else {
      // No container name — soft-delete
      log(
        `get-or-create: session ${existingSession.id} has no container, soft-deleting`,
      )
      await softDeleteSession(db, existingSession.id)
    }
  }

  // No active session — create a new one
  log(
    `get-or-create: creating new session (user=${userId}, problem=${problemId}, testcase=${testcaseId})`,
  )

  const sessionId = await insertTerminalSession(db, {
    userId,
    problemId,
    testcaseId,
  })

  // Try to claim a warm container first
  const claimedContainerName = await tryClaimWarmContainerInternal(
    problemSlug,
    testcaseId,
  )

  let containerName: string

  if (claimedContainerName) {
    containerName = claimedContainerName
    await updateSessionContainerName(db, sessionId, containerName)
    log(
      `get-or-create: claimed warm container ${containerName} for session ${sessionId}`,
    )
  } else {
    // Create on-demand
    containerName = generateContainerName()
    const containerDir = getContainerDir(containerName)
    await mkdirp(containerDir)

    const image = `easyshell-${problemSlug}-${testcaseId}`
    const imageTag = resolveImageTag(image)

    const args: string[] = [
      "-q",
      "-d",
      "--rm",
      "--name",
      containerName,
      "-m",
      isK3s ? "1g" : "10m",
      "--memory-swap",
      isK3s ? "1g" : "10m",
      "--cpus",
      isK3s ? "1.0" : "0.1",
      "-v",
      `${containerDir}:/tmp/easyshell`,
      "--label",
      `sh.easyshell.problem=${problemSlug}`,
      "--label",
      `sh.easyshell.testcase=${testcaseId}`,
      "--label",
      "sh.easyshell.mode=session",
      "--label",
      `sh.easyshell.type=${problemType}`,
    ]

    if (env.DOCKER_REGISTRY) args.push("--pull=always")
    if (isK3s) {
      args.push("--privileged")
      args.push("--cgroupns=private")
      args.push("--tmpfs", "/run")
      args.push("--tmpfs", "/var/run")
    }

    args.push(imageTag)

    if (isK3s) {
      args.push("-mode", "k3s-session")
    } else {
      args.push("-mode", "session")
    }

    try {
      await dockerRun(args)
    } catch (err) {
      log("get-or-create: container create failed:", err)
      return c.text(
        `Failed to create container: ${err instanceof Error ? err.message : String(err)}`,
        500,
      )
    }

    // Insert container record
    await insertContainer(db, {
      name: containerName,
      image,
      problem: problemSlug,
      testcase: testcaseId,
      mode: "session",
      type: problemType,
      memory: isK3s ? "1g" : "10m",
      cpu: isK3s ? "1.0" : "0.1",
    })

    await updateSessionContainerName(db, sessionId, containerName)
    log(
      `get-or-create: created container ${containerName} for session ${sessionId}`,
    )
  }

  // Fetch the newly created session
  const newSession = await findActiveSession(db, {
    userId,
    problemId,
    testcaseId,
  })

  if (!newSession) {
    return c.text("Failed to create terminal session", 500)
  }

  const logs = await getSessionLogs(db, newSession.id)

  return c.json({
    id: newSession.id,
    container_name: newSession.containerName,
    created_at: newSession.createdAt.toISOString(),
    expires_at: newSession.expiresAt.toISOString(),
    ready: !isK3s,
    logs: logs.map((l) => ({
      id: l.id,
      stdin: l.stdin,
      stdout: l.stdout,
      stderr: l.stderr,
      started_at: l.startedAt.toISOString(),
      finished_at: l.finishedAt.toISOString(),
    })),
  })
})

/**
 * Internal helper: try to claim a warm container for the given problem+testcase.
 * Returns the container name if successfully claimed, or null if none available.
 */
async function tryClaimWarmContainerInternal(
  problemSlug: string,
  testcaseId: number,
): Promise<string | null> {
  try {
    const containers = await findContainers(db, {
      mode: "warm",
      problem: problemSlug,
      testcase: testcaseId,
    })

    if (containers.length === 0) {
      log(
        `tryClaimWarm: no warm containers for ${problemSlug} testcase=${testcaseId}`,
      )
      return null
    }

    for (const container of containers) {
      const claimed = await claimContainer(db, container.name)
      if (claimed) {
        log(
          `tryClaimWarm: claimed ${container.name} for ${problemSlug} testcase=${testcaseId}`,
        )
        return container.name
      }
      log(`tryClaimWarm: claim failed for ${container.name} (race lost)`)
    }

    log(
      `tryClaimWarm: all warm containers already claimed for ${problemSlug} testcase=${testcaseId}`,
    )
    return null
  } catch (error) {
    log(`tryClaimWarm: error (will fall back to on-demand): ${error}`)
    return null
  }
}

// =============================================================================
// POST /terminal-session/kill
// =============================================================================

/**
 * High-level endpoint: kill all active terminal sessions for a user/problem/testcase.
 * Absorbs the logic from packages/mustang/sessions.ts: killTerminalSessions
 */
app.post("/terminal-session/kill", async (c) => {
  const body = await c.req.json()
  const userId = body.user_id as string | undefined
  const problemId = body.problem_id as number | undefined
  const testcaseId = body.testcase_id as number | undefined

  if (!userId) return c.text("Missing user_id", 400)
  if (problemId === undefined) return c.text("Missing problem_id", 400)
  if (testcaseId === undefined) return c.text("Missing testcase_id", 400)

  const deletedSessions = await softDeleteSessions(db, {
    userId,
    problemId,
    testcaseId,
  })

  log(
    `terminal-session/kill: killing ${deletedSessions.length} sessions for user=${userId} problem=${problemId} testcase=${testcaseId}`,
  )

  for (const session of deletedSessions) {
    if (session.containerName) {
      try {
        await dockerRm(session.containerName)
        await softDeleteContainer(db, session.containerName)
      } catch {
        // Container may already be stopped
      }
    }
  }

  return c.json({ deleted_sessions: deletedSessions.length })
})

// =============================================================================
// POST /terminal-session/submit-command
// =============================================================================

/**
 * High-level endpoint: execute a command in a session and log it.
 * Absorbs the logic from packages/mustang/sessions.ts: submitCommand
 */
app.post("/terminal-session/submit-command", async (c) => {
  const body = await c.req.json()
  const sessionId = body.session_id as number | undefined
  const containerName = body.container_name as string | undefined
  const command = body.command as string | undefined
  const timeoutMs = (body.timeout_ms as number | undefined) ?? 5000

  if (sessionId === undefined) return c.text("Missing session_id", 400)
  if (!containerName || !validContainerName.test(containerName))
    return c.text("Invalid container_name", 400)
  if (!command) return c.text("Missing command", 400)

  log(
    `submit-command: session=${sessionId} container=${containerName} command=${JSON.stringify(command.slice(0, 100))}`,
  )

  // Check container liveness first
  const stateOutput = await dockerInspect(containerName, "{{.State.Status}}")
  if (stateOutput === null || stateOutput !== "running") {
    return c.json(
      {
        status: "error",
        type: "session_not_running",
        message: "The session is not running",
      },
      200,
    )
  }

  // Chmod the socket (non-fatal if it fails)
  await dockerExec(containerName, ["chmod", "0777", "/tmp/easyshell/main.sock"])

  const startedAt = new Date()
  const result = await execBuffered(containerName, command)
  const finishedAt = new Date()

  if (!result.ok) {
    if (result.statusCode === 423) {
      return c.json(
        {
          status: "error",
          type: "session_error",
          message:
            "The session is locked because it is running another command",
        },
        200,
      )
    }
    return c.json(
      {
        status: "error",
        type: "session_error",
        message: "The session encountered an error",
      },
      200,
    )
  }

  // Parse the buffered response
  let stdout = ""
  let stderr = ""
  try {
    const parsed = JSON.parse(result.body)
    stdout = parsed.stdout ?? ""
    stderr = parsed.stderr ?? ""
  } catch {
    // If response is not JSON, treat the whole body as stdout
    stdout = result.body
  }

  // Log to DB
  const logId = await insertSessionLog(db, {
    sessionId,
    stdin: command,
    stdout,
    stderr,
    startedAt,
    finishedAt,
  })

  return c.json({
    status: "success",
    stdout,
    stderr,
    log_id: logId,
  })
})

// =============================================================================
// POST /sessions/cleanup
// =============================================================================

/**
 * High-level endpoint: clean up expired terminal sessions.
 * Absorbs the logic from apps/cron/jobs/cleanup.ts: cleanupExpiredSessions
 */
app.post("/sessions/cleanup", async (c) => {
  const expiredSessions = await findExpiredSessions(db)

  if (expiredSessions.length === 0) {
    return c.json({ cleaned: 0 })
  }

  log(`sessions/cleanup: found ${expiredSessions.length} expired sessions`)

  let cleaned = 0
  for (const session of expiredSessions) {
    try {
      await softDeleteSession(db, session.id)

      if (session.containerName) {
        try {
          await dockerRm(session.containerName)
          await softDeleteContainer(db, session.containerName)
          log(
            `sessions/cleanup: killed expired session ${session.id} (container=${session.containerName})`,
          )
        } catch {
          log(
            `sessions/cleanup: session ${session.id} container already gone (container=${session.containerName})`,
          )
        }
      }

      cleaned++
    } catch (error) {
      log(
        `sessions/cleanup: failed to clean up session ${session.id}: ${error}`,
      )
    }
  }

  return c.json({ cleaned })
})

// =============================================================================
// POST /submission/run
// =============================================================================

/**
 * High-level endpoint: run a full submission lifecycle and return results.
 * Absorbs the logic from packages/mustang/submissions.ts:
 *   runSubmissionAndGetOutput + runLiveEnvironmentSubmission + evaluateStandardTestcase
 *
 * The service loads ProblemInfo internally and manages I/O files itself.
 */
app.post("/submission/run", async (c) => {
  const body = await c.req.json()
  const problemSlug = body.problem_slug as string | undefined
  const testcaseId = body.testcase_id as number | undefined
  const input = body.input as string | undefined

  if (!problemSlug || !validProblemSlug.test(problemSlug))
    return c.text("Invalid problem_slug", 400)
  if (testcaseId === undefined) return c.text("Missing testcase_id", 400)
  if (input === undefined) return c.text("Missing input", 400)

  // Load problem info from the autogenerated cache
  let problemInfo: ProblemInfo
  try {
    problemInfo = await getProblemInfo(problemSlug)
  } catch (err) {
    return c.text(
      `Problem not found: ${err instanceof Error ? err.message : String(err)}`,
      404,
    )
  }

  if (isLiveEnvironmentProblem(problemInfo)) {
    return await runLiveEnvironmentSubmissionHandler(c, problemSlug, input)
  }

  if (!isStandardProblem(problemInfo)) {
    return c.text(`Unknown problem type for: ${problemSlug}`, 400)
  }

  log(
    `submission/run: standard (problem=${problemSlug}, testcase=${testcaseId}, input=${JSON.stringify(input.slice(0, 100))})`,
  )

  const startedAt = new Date()

  // Create input/output files on disk
  const suffix = randomBytes(6).toString("hex")
  const submissionsDir = getSubmissionsDir()
  const inputFilePath = join(
    submissionsDir,
    "inputs",
    `${problemSlug}-${testcaseId}-${suffix}.sh`,
  )
  const outputFilePath = join(
    submissionsDir,
    "outputs",
    `${problemSlug}-${testcaseId}-${suffix}.json`,
  )

  await writeFile(inputFilePath, input)
  await writeFile(outputFilePath, "")

  // Create submission container
  const image = `easyshell-${problemSlug}-${testcaseId}`
  const containerName = generateContainerName()
  const imageTag = resolveImageTag(image)

  const args: string[] = [
    "-q",
    "-d",
    "--rm",
    "--name",
    containerName,
    "-m",
    "10m",
    "--memory-swap",
    "10m",
    "--cpus",
    "0.1",
    "-v",
    `${inputFilePath}:/input.sh`,
    "-v",
    `${outputFilePath}:/output.json`,
    "--label",
    `sh.easyshell.problem=${problemSlug}`,
    "--label",
    `sh.easyshell.testcase=${testcaseId}`,
    "--label",
    "sh.easyshell.mode=submission",
    "--label",
    "sh.easyshell.type=standard",
  ]

  if (env.DOCKER_REGISTRY) args.push("--pull=always")
  args.push(imageTag)
  args.push("-mode", "submission")

  log("submission/run: docker run args:", args.join(" "))

  try {
    await dockerRun(args)
  } catch (err) {
    return c.text(
      `Failed to create submission container: ${err instanceof Error ? err.message : String(err)}`,
      500,
    )
  }

  // Insert container record
  await insertContainer(db, {
    name: containerName,
    image,
    problem: problemSlug,
    testcase: testcaseId,
    mode: "submission",
    type: "standard",
    memory: "10m",
    cpu: "0.1",
  })

  log(`submission/run: container ${containerName} created, polling...`)

  // Poll until finished
  const maxWaitMs = 120_000
  const pollStart = Date.now()
  let pollCount = 0

  while (Date.now() - pollStart < maxWaitMs) {
    pollCount++

    // Check if container still exists (standard uses --rm)
    const stateOutput = await dockerInspect(containerName, "{{.State.Status}}")

    if (stateOutput === null || stateOutput !== "running") {
      // Container gone or exited — read output file
      try {
        const data = await readFile(outputFilePath, "utf-8")
        if (!data) {
          return c.text("Submission finished but output file is empty", 500)
        }
        const output = JSON.parse(data)
        const finishedAt = new Date()
        const passed = evaluateStandardTestcase(output, problemInfo, testcaseId)

        log(
          `submission/run: finished in ${finishedAt.getTime() - startedAt.getTime()}ms after ${pollCount} polls: passed=${passed}`,
        )
        return c.json({
          started_at: startedAt.toISOString(),
          finished_at: finishedAt.toISOString(),
          output,
          passed,
        })
      } catch (err) {
        return c.text(
          `Submission finished but output not available: ${err instanceof Error ? err.message : String(err)}`,
          500,
        )
      }
    }

    await sleep(500)
  }

  return c.text(
    `Submission container ${containerName} did not finish within 2 minutes`,
    500,
  )
})

/**
 * Handle live-environment submission flow (k3s).
 */
async function runLiveEnvironmentSubmissionHandler(
  c: Context,
  problemSlug: string,
  input: string,
) {
  const tag = `easyshell-${problemSlug}-1`
  const startedAt = new Date()

  log(`submission/run: creating k3s container (image=${tag})`)

  const containerName = generateContainerName()
  const containerDir = getContainerDir(containerName)
  await mkdirp(containerDir)
  const imageTag = resolveImageTag(tag)

  const args: string[] = [
    "-q",
    "-d",
    "--name",
    containerName,
    "-m",
    "1g",
    "--memory-swap",
    "1g",
    "--cpus",
    "1.0",
    "-v",
    `${containerDir}:/tmp/easyshell`,
    "--label",
    `sh.easyshell.problem=${problemSlug}`,
    "--label",
    "sh.easyshell.testcase=1",
    "--label",
    "sh.easyshell.mode=submission",
    "--label",
    "sh.easyshell.type=k3s",
    "--privileged",
    "--cgroupns=private",
    "--tmpfs",
    "/run",
    "--tmpfs",
    "/var/run",
  ]

  if (env.DOCKER_REGISTRY) args.push("--pull=always")
  args.push(imageTag)
  args.push("-mode", "k3s-session")

  try {
    await dockerRun(args)
  } catch (err) {
    return c.text(
      `Failed to create k3s container: ${err instanceof Error ? err.message : String(err)}`,
      500,
    )
  }

  // Insert container record
  await insertContainer(db, {
    name: containerName,
    image: tag,
    problem: problemSlug,
    testcase: 1,
    mode: "submission",
    type: "k3s",
    memory: "1g",
    cpu: "1.0",
  })

  log(
    `submission/run: k3s container ${containerName} created, waiting for readiness...`,
  )

  try {
    // Wait for readiness
    const maxWaitMs = 180_000
    const waitStart = Date.now()
    let ready = false
    let readyPolls = 0

    while (Date.now() - waitStart < maxWaitMs) {
      readyPolls++
      const stateOutput = await dockerInspect(
        containerName,
        "{{.State.Status}}",
      )

      if (stateOutput === null) {
        log(
          `submission/run: k3s container disappeared after ${readyPolls} polls`,
        )
        const finishedAt = new Date()
        return c.json({
          started_at: startedAt.toISOString(),
          finished_at: finishedAt.toISOString(),
          output: {
            stdout: "Container disappeared before becoming ready",
            stderr: "",
            exit_code: 1,
            fs: {},
          },
          passed: false,
        })
      }

      if (stateOutput !== "running") {
        log(
          `submission/run: k3s container stopped before ready after ${readyPolls} polls`,
        )
        const finishedAt = new Date()
        return c.json({
          started_at: startedAt.toISOString(),
          finished_at: finishedAt.toISOString(),
          output: {
            stdout: "Container stopped before becoming ready",
            stderr: "",
            exit_code: 1,
            fs: {},
          },
          passed: false,
        })
      }

      // Check for error file
      const errResult = await dockerExec(containerName, [
        "cat",
        "/tmp/easyshell/ready.error",
      ])
      if (errResult.exitCode === 0) {
        log(
          `submission/run: setup failed after ${readyPolls} polls: ${errResult.stdout.trim()}`,
        )
        const finishedAt = new Date()
        return c.json({
          started_at: startedAt.toISOString(),
          finished_at: finishedAt.toISOString(),
          output: {
            stdout: `Environment setup failed: ${errResult.stdout.trim()}`,
            stderr: "",
            exit_code: 1,
            fs: {},
          },
          passed: false,
        })
      }

      // Check for ready file
      const readyResult = await dockerExec(containerName, [
        "cat",
        "/tmp/easyshell/ready",
      ])
      if (readyResult.exitCode === 0 && readyResult.stdout.trim() === "ready") {
        const elapsedSec = ((Date.now() - waitStart) / 1000).toFixed(1)
        log(
          `submission/run: k3s ready after ${elapsedSec}s (${readyPolls} polls)`,
        )
        ready = true
        break
      }

      await sleep(2000)
    }

    if (!ready) {
      log(`submission/run: k3s did not become ready within 3 minutes`)
      const finishedAt = new Date()
      return c.json({
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        output: {
          stdout: "Environment did not become ready within 3 minutes",
          stderr: "",
          exit_code: 1,
          fs: {},
        },
        passed: false,
      })
    }

    // Execute user input
    if (input.trim().length > 0) {
      log(`submission/run: executing user input (${input.length} chars)`)

      // Chmod socket
      await dockerExec(containerName, [
        "chmod",
        "0777",
        "/tmp/easyshell/main.sock",
      ])

      try {
        await execBuffered(containerName, input)
        log(`submission/run: user input executed`)
      } catch {
        log(`submission/run: user input threw (non-fatal)`)
      }
    }

    // Run check.sh
    log(`submission/run: running check.sh...`)
    const checkResult = await dockerExec(containerName, ["bash", "/check.sh"], {
      KUBECONFIG: "/etc/rancher/k3s/k3s.yaml",
    })

    const finishedAt = new Date()

    if (
      checkResult.exitCode !== 0 &&
      checkResult.stdout.length === 0 &&
      checkResult.stderr.length === 0
    ) {
      return c.json({
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        output: {
          stdout: "Check did not return a score",
          stderr: "",
          exit_code: 1,
          fs: {},
        },
        passed: false,
      })
    }

    const score = parseScore(checkResult.stdout + checkResult.stderr)
    const totalMs = finishedAt.getTime() - startedAt.getTime()
    log(
      `submission/run: live-env done in ${totalMs}ms: score=${score.score}/${score.total} passed=${score.passed}`,
    )

    return c.json({
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      output: {
        stdout: score.raw_output,
        stderr: "",
        exit_code: score.passed ? 0 : 1,
        fs: {},
      },
      passed: score.passed,
    })
  } finally {
    // Clean up: kill the container
    log(`submission/run: cleaning up container ${containerName}`)
    try {
      await dockerRm(containerName)
      await softDeleteContainer(db, containerName)
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Evaluate a standard submission output against expected testcase values.
 * Ported from packages/mustang/submissions.ts: evaluateStandardTestcase
 */
function evaluateStandardTestcase(
  output: {
    stdout: string
    stderr: string
    exit_code: number
    fs?: Record<string, string>
  },
  problemInfo: ProblemInfo,
  testcaseId: number,
): boolean {
  if (!isStandardProblem(problemInfo)) return false

  const testcase = problemInfo.testcases.find((t) => t.id === testcaseId)
  if (!testcase) {
    log(`evaluateStandardTestcase: testcase ${testcaseId} not found`)
    return false
  }

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
    passed = output.stderr === testcase.expected_stderr
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

// =============================================================================
// Startup
// =============================================================================

async function main() {
  await initWorkingDirs()

  const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    log(`listening on port ${info.port}`)
  })

  // Graceful shutdown
  function shutdown() {
    log("shutting down...")
    server.close(() => {
      process.exit(0)
    })
    // Force exit after 10s if connections don't close
    setTimeout(() => process.exit(1), 10_000).unref()
  }

  process.on("SIGTERM", shutdown)
  process.on("SIGINT", shutdown)
}

main().catch((err) => {
  console.error("[mustang] Fatal error:", err)
  process.exit(1)
})
