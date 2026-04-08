import { readFile, stat } from "node:fs/promises"
import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { bearerAuth } from "hono/bearer-auth"
import { streamSSE } from "hono/streaming"

import { createDb } from "@easyshell/db"

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
import { execBuffered, execStream } from "./socket"
import {
  allowedCgroupNs,
  allowedModes,
  allowedTypes,
  generateContainerName,
  getContainerDir,
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
