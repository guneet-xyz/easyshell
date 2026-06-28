/* eslint-disable @typescript-eslint/no-explicit-any */
// E2E global setup — boots the full Coordinator+Runner stack against a
// Postgres Testcontainer. See task T6 spec for details.

import { type ChildProcess, execSync, spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql"

const ROOT = path.resolve(import.meta.dirname, "../../..")
const STATE_PATH = "/tmp/easyshell-e2e-state.json"

const COORDINATOR_PORT = 4199
const RUNNER_PORT = 4299
const COORDINATOR_URL = `http://localhost:${COORDINATOR_PORT}`
const RUNNER_PUBLIC_URL = `http://localhost:${RUNNER_PORT}`
const COORDINATOR_TOKEN = "test-token"
const REGISTRATION_TOKEN = "test-reg-token"
const WORKING_DIR = "/tmp/easyshell-e2e"

let pgContainer: StartedPostgreSqlContainer | undefined
let coordinatorProcess: ChildProcess | undefined
let runnerProcess: ChildProcess | undefined

async function waitForCoordinatorHealth(): Promise<void> {
  const deadline = Date.now() + 30_000
  const url = `${COORDINATOR_URL}/health.ping?input=${encodeURIComponent("{}")}`
  let lastErr: unknown
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return
      lastErr = `http ${res.status}`
    } catch (err) {
      lastErr = err
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`coordinator health never became ready: ${String(lastErr)}`)
}

async function waitForRunnerRegistration(databaseUrl: string): Promise<string> {
  const { default: postgres } = await import("postgres")
  const sql = postgres(databaseUrl, { max: 1 })
  try {
    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
      const rows = await sql<{ id: string }[]>`
        SELECT id FROM easyshell_runner
        WHERE status = 'active'
        ORDER BY registered_at DESC
        LIMIT 1
      `
      if (rows.length > 0 && rows[0]?.id) return rows[0].id
      await new Promise((r) => setTimeout(r, 500))
    }
    throw new Error("runner never appeared in easyshell_runner table")
  } finally {
    await sql.end({ timeout: 5 })
  }
}

function bootstrapRunner(databaseUrl: string): Promise<{
  runnerId: string
  runnerSecret: string
}> {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", [path.join(ROOT, "apps/runner/runner.cjs")], {
      env: {
        ...process.env,
        RUNNER_NAME: "e2e-runner",
        RUNNER_PUBLIC_URL,
        RUNNER_PORT: String(RUNNER_PORT),
        COORDINATOR_URL,
        COORDINATOR_REGISTRATION_TOKEN: REGISTRATION_TOKEN,
        RUNNER_DB_PATH: ":memory:",
        WORKING_DIR,
        SUBMISSION_MAX_CONCURRENCY: "4",
        SESSION_MAX_CONCURRENCY: "64",
        LOG_LEVEL: "fatal",
        NODE_ENV: "production",
        DATABASE_URL: databaseUrl,
      },
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stderr = ""
    let stdout = ""
    proc.stdout?.on("data", (b: Buffer) => {
      stdout += b.toString()
    })
    proc.stderr?.on("data", (b: Buffer) => {
      stderr += b.toString()
    })

    const timer = setTimeout(() => {
      proc.kill("SIGKILL")
      reject(
        new Error(
          `bootstrap runner timed out\nstderr:\n${stderr}\nstdout:\n${stdout}`,
        ),
      )
    }, 30_000)

    proc.on("exit", (code) => {
      clearTimeout(timer)
      const match = stderr.match(
        /BOOTSTRAP-ME:\s+runner_id=(\S+)\s+runner_secret=(\S+)/,
      )
      if (!match) {
        reject(
          new Error(
            `bootstrap runner exited (code=${String(code)}) without BOOTSTRAP-ME\nstderr:\n${stderr}\nstdout:\n${stdout}`,
          ),
        )
        return
      }
      resolve({ runnerId: match[1]!, runnerSecret: match[2]! })
    })
  })
}

function spawnCoordinator(databaseUrl: string): ChildProcess {
  const proc = spawn(
    "node",
    [path.join(ROOT, "apps/coordinator/coordinator.cjs")],
    {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        COORDINATOR_TOKEN,
        COORDINATOR_REGISTRATION_TOKEN: REGISTRATION_TOKEN,
        MAX_ATTEMPTS: "3",
        LOG_LEVEL: "fatal",
        NODE_ENV: "production",
        COORDINATOR_PORT: String(COORDINATOR_PORT),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  )
  proc.on("exit", (code, signal) => {
    if (code !== 0 && code !== null && signal !== "SIGTERM") {
      process.stderr.write(
        `coordinator exited unexpectedly code=${String(code)} signal=${String(signal)}\n`,
      )
    }
  })
  return proc
}

function spawnRunner(
  databaseUrl: string,
  runnerId: string,
  runnerSecret: string,
): ChildProcess {
  const proc = spawn("node", [path.join(ROOT, "apps/runner/runner.cjs")], {
    env: {
      ...process.env,
      RUNNER_ID: runnerId,
      RUNNER_SECRET: runnerSecret,
      RUNNER_NAME: "e2e-runner",
      RUNNER_PUBLIC_URL,
      RUNNER_PORT: String(RUNNER_PORT),
      COORDINATOR_URL,
      COORDINATOR_REGISTRATION_TOKEN: REGISTRATION_TOKEN,
      RUNNER_DB_PATH: ":memory:",
      WORKING_DIR,
      SUBMISSION_MAX_CONCURRENCY: "4",
      SESSION_MAX_CONCURRENCY: "64",
      LOG_LEVEL: "fatal",
      NODE_ENV: "production",
      DATABASE_URL: databaseUrl,
    },
    stdio: ["ignore", "pipe", "pipe"],
  })
  proc.on("exit", (code, signal) => {
    if (code !== 0 && code !== null && signal !== "SIGTERM") {
      process.stderr.write(
        `runner exited unexpectedly code=${String(code)} signal=${String(signal)}\n`,
      )
    }
  })
  return proc
}

async function killProcess(
  proc: ChildProcess | undefined,
  label: string,
): Promise<void> {
  if (!proc || proc.pid === undefined || proc.exitCode !== null) return
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      try {
        proc.kill("SIGKILL")
      } catch {
        /* ignore */
      }
      resolve()
    }, 5_000)
    proc.once("exit", () => {
      clearTimeout(timer)
      resolve()
    })
    try {
      proc.kill("SIGTERM")
    } catch (err) {
      process.stderr.write(`failed to SIGTERM ${label}: ${String(err)}\n`)
      clearTimeout(timer)
      resolve()
    }
  })
}

export async function setup(): Promise<void> {
  if (!fs.existsSync(WORKING_DIR)) fs.mkdirSync(WORKING_DIR, { recursive: true })

  // 1. Start Postgres Testcontainer.
  pgContainer = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("easyshell_e2e")
    .withUsername("postgres")
    .withPassword("postgres")
    .start()
  const databaseUrl = pgContainer.getConnectionUri()

  // 2. Run drizzle migrations against it.
  execSync("pnpm exec drizzle-kit migrate", {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  })

  // 3. Spawn coordinator and wait for health.
  coordinatorProcess = spawnCoordinator(databaseUrl)
  await waitForCoordinatorHealth()

  // 4. Bootstrap runner (one-shot — exits 0 after registering).
  const { runnerId, runnerSecret } = await bootstrapRunner(databaseUrl)

  // 5. Spawn the long-lived runner with credentials and wait for heartbeat row.
  runnerProcess = spawnRunner(databaseUrl, runnerId, runnerSecret)
  await waitForRunnerRegistration(databaseUrl)

  // 6. Persist shared state for the test workers.
  fs.writeFileSync(
    STATE_PATH,
    JSON.stringify({
      coordinatorUrl: COORDINATOR_URL,
      coordinatorToken: COORDINATOR_TOKEN,
      databaseUrl,
      runnerId,
    }),
  )
}

export async function teardown(): Promise<void> {
  await killProcess(runnerProcess, "runner")
  await killProcess(coordinatorProcess, "coordinator")
  if (pgContainer) {
    try {
      await pgContainer.stop({ timeout: 10_000 })
    } catch (err) {
      process.stderr.write(`failed to stop pg container: ${String(err)}\n`)
    }
  }
  try {
    fs.rmSync(STATE_PATH, { force: true })
  } catch {
    /* ignore */
  }
}
