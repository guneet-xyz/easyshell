/* eslint-disable @typescript-eslint/no-explicit-any */
// E2E global setup — boots the full Coordinator+Runner stack against a
// Postgres Testcontainer. See task T6 spec for details.

import { execSync, spawn, type ChildProcess } from "node:child_process"
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
const WEBSITE_TOKEN = "test-token"
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

async function seedRunner(databaseUrl: string): Promise<{
  runnerId: string
  runnerToken: string
}> {
  const { default: postgres } = await import("postgres")
  const { createHash, randomBytes } = await import("node:crypto")

  const sql = postgres(databaseUrl, { max: 1 })

  const runnerId = randomBytes(16).toString("hex")
  const runnerToken = randomBytes(32).toString("hex")
  const secretHash = createHash("sha256").update(runnerToken).digest("hex")
  // Plaintext envelope — matches coordinator's secret.ts fallback when
  // COORDINATOR_SECRET_KEY is unset (see apps/coordinator/src/services/secret.ts).
  const secretCiphertext = Buffer.from(runnerToken, "utf8").toString("base64")
  const secretNonce = "plaintext"

  try {
    await sql`
      INSERT INTO easyshell_runner (
        id, name, public_url, secret_hash, secret_ciphertext, secret_nonce
      ) VALUES (
        ${runnerId}, ${"e2e-runner"}, ${RUNNER_PUBLIC_URL},
        ${secretHash}, ${secretCiphertext}, ${secretNonce}
      )
    `
    await sql`
      INSERT INTO easyshell_runner_capability (runner_id, mode, concurrency)
      VALUES
        (${runnerId}, ${"submission"}, ${4}),
        (${runnerId}, ${"session"}, ${64})
    `
  } finally {
    await sql.end({ timeout: 5 })
  }

  process.stdout.write(`e2e: seeded runner_id=${runnerId}\n`)
  return { runnerId, runnerToken }
}

function spawnCoordinator(databaseUrl: string): ChildProcess {
  const proc = spawn(
    "node",
    [path.join(ROOT, "apps/coordinator/coordinator.cjs")],
    {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        WEBSITE_TOKEN,
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
  runnerToken: string,
): ChildProcess {
  const proc = spawn("node", [path.join(ROOT, "apps/runner/runner.cjs")], {
    env: {
      ...process.env,
      RUNNER_ID: runnerId,
      RUNNER_TOKEN: runnerToken,
      RUNNER_NAME: "e2e-runner",
      RUNNER_PUBLIC_URL,
      RUNNER_PORT: String(RUNNER_PORT),
      COORDINATOR_URL,
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

function buildStandaloneBundles(): void {
  execSync("pnpm --filter @easyshell/coordinator build", {
    cwd: ROOT,
    stdio: "inherit",
  })
  execSync("pnpm --filter @easyshell/runner build", {
    cwd: ROOT,
    stdio: "inherit",
  })
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
  if (!fs.existsSync(WORKING_DIR))
    fs.mkdirSync(WORKING_DIR, { recursive: true })
  buildStandaloneBundles()

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

  // 4. Seed a runner row directly (coordinator has no bootstrap endpoint).
  const { runnerId, runnerToken } = await seedRunner(databaseUrl)

  // 5. Spawn the long-lived runner with credentials.
  runnerProcess = spawnRunner(databaseUrl, runnerId, runnerToken)

  // 6. Persist shared state for the test workers.
  fs.writeFileSync(
    STATE_PATH,
    JSON.stringify({
      coordinatorUrl: COORDINATOR_URL,
      coordinatorToken: WEBSITE_TOKEN,
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
