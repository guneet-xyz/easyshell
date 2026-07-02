// ==========================================
// Unit tests for the terminalSessions.* tRPC router.
//
// All four procedures (create / exec / isRunning / kill) are coordinator-
// only. We mock:
//   • `../../src/docker/cli` so dockerRun / dockerKill / dockerInspect
//     never spawn real docker processes
//   • `../../src/db/sqlite` so getDb returns a real in-memory SQLite
//     instance with the production schema applied
//   • `node:http` so `exec` can talk to a fake unix-socket server
//     without actually opening a socket; the mock returns a tiny
//     EventEmitter pair that lets each test script the HTTP response
//     (200 with body, 423 Locked, 5xx error, or a request-level error)
// ==========================================

import { EventEmitter } from "node:events"
import fs from "node:fs"
import Database from "better-sqlite3"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import { migrate } from "../../src/db/migrations"

const { TEST_WORKING_DIR, dockerState, dbHolder, httpRequestMock } = vi.hoisted(
  () => ({
    TEST_WORKING_DIR: `/tmp/easyshell-test-terminals-${process.pid}`,
    dockerState: {
      run: vi.fn(),
      kill: vi.fn(),
      inspect: vi.fn(),
    },
    dbHolder: { db: null as Database.Database | null },
    httpRequestMock: vi.fn(),
  }),
)

vi.mock("../../src/env", () => ({
  env: {
    RUNNER_SECRET:
      "test-secret-64hex0000000000000000000000000000000000000000000000000000",
    RUNNER_PORT: 4200,
    RUNNER_NAME: "test-runner",
    RUNNER_PUBLIC_URL: "http://localhost:4200",
    RUNNER_ID: "test-runner-id",
    COORDINATOR_URL: "http://localhost:4100",
    COORDINATOR_REGISTRATION_TOKEN: "test-reg",
    WORKING_DIR: TEST_WORKING_DIR,
    RUNNER_DB_PATH: ":memory:",
    SUBMISSION_MAX_CONCURRENCY: 4,
    SESSION_MAX_CONCURRENCY: 64,
    LOG_LEVEL: "silent",
    NODE_ENV: "test",
    RUNNER_LABELS: {},
    DOCKER_REGISTRY: undefined,
  },
}))

vi.mock("@easyshell/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({})),
  }),
}))

vi.mock("../../src/docker/cli", () => ({
  dockerRun: (...args: unknown[]) => dockerState.run(...args),
  dockerKill: (...args: unknown[]) => dockerState.kill(...args),
  dockerInspect: (...args: unknown[]) => dockerState.inspect(...args),
}))

vi.mock("../../src/db/sqlite", () => ({
  getDb: () => {
    if (!dbHolder.db) throw new Error("test db not initialized")
    return dbHolder.db
  },
}))

vi.mock("../../src/services/capacity", () => ({
  getCapacity: () => ({
    session_used: 0,
    session_max: 64,
    submission_used: 0,
    submission_max: 4,
  }),
  incrementSubmission: vi.fn(),
  decrementSubmission: vi.fn(),
  incrementSession: vi.fn(),
  decrementSession: vi.fn(),
}))

vi.mock("node:http", () => ({
  default: { request: httpRequestMock },
  request: httpRequestMock,
}))

function makeMemDb(): Database.Database {
  const db = new Database(":memory:")
  db.pragma("foreign_keys = ON")
  migrate(db)
  return db
}

// ─── HTTP mock helpers ───────────────────────────────────────────────────────
//
// `http.request(opts, cb)` returns a writable request object. The
// callback fires with a readable response object that emits "data"
// then "end". We model both with EventEmitter — the SUT only uses
// .on / .write / .end / .setTimeout / .destroy.

type FakeReq = EventEmitter & {
  setTimeout: ReturnType<typeof vi.fn>
  write: ReturnType<typeof vi.fn>
  end: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
}

type FakeRes = EventEmitter & { statusCode?: number }

function makeFakeReq(): FakeReq {
  const req = new EventEmitter() as FakeReq
  req.setTimeout = vi.fn()
  req.write = vi.fn()
  req.end = vi.fn()
  req.destroy = vi.fn()
  return req
}

/**
 * Drives `http.request` to call its response callback with a fake
 * response that emits the given body and then `end`. statusCode is
 * 200 unless overridden.
 */
function mockSocketResponse(opts: {
  statusCode?: number
  body?: string
}): FakeReq {
  const req = makeFakeReq()
  httpRequestMock.mockImplementation((_reqOpts, cb: (res: FakeRes) => void) => {
    queueMicrotask(() => {
      const res = new EventEmitter() as FakeRes
      res.statusCode = opts.statusCode ?? 200
      cb(res)
      if (opts.body) res.emit("data", Buffer.from(opts.body, "utf8"))
      res.emit("end")
    })
    return req
  })
  return req
}

/**
 * Drives `http.request` to emit a request-level error (the socket file
 * is missing, ENOENT, etc.). settle() resolves with type='session_not_running'.
 */
function mockSocketRequestError(err: Error): FakeReq {
  const req = makeFakeReq()
  httpRequestMock.mockImplementation(() => {
    queueMicrotask(() => req.emit("error", err))
    return req
  })
  return req
}

const { terminalSessionsRouter } = await import(
  "../../src/routers/terminal-sessions"
)

afterAll(() => {
  if (fs.existsSync(TEST_WORKING_DIR)) {
    fs.rmSync(TEST_WORKING_DIR, { recursive: true, force: true })
  }
})

describe("routers/terminal-sessions", () => {
  beforeEach(() => {
    dockerState.run.mockReset()
    dockerState.kill.mockReset()
    dockerState.inspect.mockReset()
    httpRequestMock.mockReset()
    dbHolder.db = makeMemDb()
    fs.mkdirSync(TEST_WORKING_DIR, { recursive: true })
  })

  describe("auth", () => {
    it("rejects non-coordinator callers on every procedure", async () => {
      const caller = terminalSessionsRouter.createCaller({ actor: "unauth" })
      await expect(
        caller.create({ container_name: "x", image: "i" }),
      ).rejects.toThrow(/UNAUTHORIZED|Coordinator credentials required/)
      await expect(
        caller.exec({ container_name: "x", command: "ls" }),
      ).rejects.toThrow(/UNAUTHORIZED|Coordinator credentials required/)
      await expect(caller.isRunning({ container_name: "x" })).rejects.toThrow(
        /UNAUTHORIZED|Coordinator credentials required/,
      )
      await expect(caller.kill({ container_name: "x" })).rejects.toThrow(
        /UNAUTHORIZED|Coordinator credentials required/,
      )
    })
  })

  describe("create", () => {
    it("runs docker with -d, inserts the three rows, returns {ok:true}", async () => {
      dockerState.run.mockResolvedValue({
        stdout: "container-id\n",
        stderr: "",
        exitCode: 0,
      })
      const caller = terminalSessionsRouter.createCaller({
        actor: "coordinator",
      })

      const result = await caller.create({
        container_name: "easyshell-sess-1",
        image: "easyshell-foo",
      })
      expect(result).toEqual({ ok: true })

      expect(dockerState.run).toHaveBeenCalledTimes(1)
      const runArgs = dockerState.run.mock.calls[0]?.[0] as {
        containerName: string
        image: string
        mode: string
        detach: boolean
        extraVolumes: string[]
      }
      expect(runArgs.mode).toBe("session")
      expect(runArgs.detach).toBe(true)
      expect(runArgs.containerName).toBe("easyshell-sess-1")
      expect(runArgs.image).toBe("easyshell-foo")
      expect(runArgs.extraVolumes?.[0]).toContain("easyshell-sess-1")

      const job = dbHolder
        .db!.prepare(
          "SELECT job_id, mode, status FROM accepted_job WHERE container_name=?",
        )
        .get("easyshell-sess-1") as {
        job_id: string
        mode: string
        status: string
      }
      expect(job.job_id).toBe("session-easyshell-sess-1")
      expect(job.mode).toBe("session")
      expect(job.status).toBe("running")

      const container = dbHolder
        .db!.prepare(
          "SELECT docker_state FROM container WHERE container_name=?",
        )
        .get("easyshell-sess-1") as { docker_state: string }
      expect(container.docker_state).toBe("running")

      const terminal = dbHolder
        .db!.prepare(
          "SELECT socket_path FROM terminal_session WHERE container_name=?",
        )
        .get("easyshell-sess-1") as { socket_path: string }
      expect(terminal.socket_path).toContain("main.sock")
    })

    it("marks status='failed' and throws when docker run fails", async () => {
      dockerState.run.mockResolvedValue({
        stdout: "",
        stderr: "pull access denied",
        exitCode: 125,
      })
      const caller = terminalSessionsRouter.createCaller({
        actor: "coordinator",
      })

      await expect(
        caller.create({
          container_name: "easyshell-sess-fail",
          image: "missing-image",
        }),
      ).rejects.toThrow(/docker run failed/)

      const row = dbHolder
        .db!.prepare(
          "SELECT status, error_message FROM accepted_job WHERE container_name=?",
        )
        .get("easyshell-sess-fail") as {
        status: string
        error_message: string | null
      }
      expect(row.status).toBe("failed")
      expect(row.error_message).toContain("pull access denied")
    })
  })

  describe("exec", () => {
    function seedTerminalSession(containerName: string): string {
      const socketPath = `${TEST_WORKING_DIR}/sessions/${containerName}/main.sock`
      const now = Date.now()
      dbHolder.db!.transaction(() => {
        dbHolder
          .db!.prepare(
            `INSERT INTO accepted_job (job_id, container_name, image, mode, status, accepted_at) VALUES (?,?,?,?,?,?)`,
          )
          .run(
            `session-${containerName}`,
            containerName,
            "easyshell-foo",
            "session",
            "running",
            now,
          )
        dbHolder
          .db!.prepare(
            `INSERT INTO container (container_name, job_id, docker_state, working_dir, created_at) VALUES (?,?,?,?,?)`,
          )
          .run(
            containerName,
            `session-${containerName}`,
            "running",
            "/tmp",
            now,
          )
        dbHolder
          .db!.prepare(
            `INSERT INTO terminal_session (container_name, job_id, socket_path, created_at) VALUES (?,?,?,?)`,
          )
          .run(containerName, `session-${containerName}`, socketPath, now)
      })()
      return socketPath
    }

    it("returns success and writes a command_log row with exit_status='ok'", async () => {
      const socketPath = seedTerminalSession("easyshell-sess-exec")
      mockSocketResponse({
        statusCode: 200,
        body: JSON.stringify({ stdout: "out\n", stderr: "" }),
      })

      const caller = terminalSessionsRouter.createCaller({
        actor: "coordinator",
      })
      const result = await caller.exec({
        container_name: "easyshell-sess-exec",
        command: "ls /",
      })
      expect(result).toEqual({
        status: "success",
        stdout: "out\n",
        stderr: "",
      })

      // http.request was called with the seeded socketPath.
      expect(httpRequestMock).toHaveBeenCalledTimes(1)
      const httpCallOpts = httpRequestMock.mock.calls[0]?.[0] as {
        socketPath: string
        path: string
        method: string
      }
      expect(httpCallOpts.socketPath).toBe(socketPath)
      expect(httpCallOpts.path).toBe("/")
      expect(httpCallOpts.method).toBe("POST")

      const log = dbHolder
        .db!.prepare(
          "SELECT command, stdout, stderr, exit_status FROM command_log WHERE container_name=?",
        )
        .get("easyshell-sess-exec") as {
        command: string
        stdout: string | null
        stderr: string | null
        exit_status: string
      }
      expect(log).toEqual({
        command: "ls /",
        stdout: "out\n",
        stderr: "",
        exit_status: "ok",
      })

      // last_exec_at must have been bumped.
      const ts = dbHolder
        .db!.prepare(
          "SELECT last_exec_at FROM terminal_session WHERE container_name=?",
        )
        .get("easyshell-sess-exec") as { last_exec_at: number }
      expect(ts.last_exec_at).toBeGreaterThan(0)
    })

    it("returns error/container_locked and writes exit_status='locked' on 423", async () => {
      seedTerminalSession("easyshell-sess-locked")
      mockSocketResponse({ statusCode: 423 })

      const caller = terminalSessionsRouter.createCaller({
        actor: "coordinator",
      })
      const result = await caller.exec({
        container_name: "easyshell-sess-locked",
        command: "ls",
      })
      expect(result.status).toBe("error")
      if (result.status === "error") {
        expect(result.type).toBe("container_locked")
      }

      const log = dbHolder
        .db!.prepare(
          "SELECT exit_status FROM command_log WHERE container_name=?",
        )
        .get("easyshell-sess-locked") as { exit_status: string }
      expect(log.exit_status).toBe("locked")
    })

    it("returns error/session_error and writes exit_status='error' on 5xx", async () => {
      seedTerminalSession("easyshell-sess-500")
      mockSocketResponse({ statusCode: 500, body: "internal" })

      const caller = terminalSessionsRouter.createCaller({
        actor: "coordinator",
      })
      const result = await caller.exec({
        container_name: "easyshell-sess-500",
        command: "ls",
      })
      expect(result.status).toBe("error")
      if (result.status === "error") {
        expect(result.type).toBe("session_error")
        expect(result.message).toContain("internal")
      }
      const log = dbHolder
        .db!.prepare(
          "SELECT exit_status FROM command_log WHERE container_name=?",
        )
        .get("easyshell-sess-500") as { exit_status: string }
      expect(log.exit_status).toBe("error")
    })

    it("returns error/session_not_running when the socket file is gone", async () => {
      seedTerminalSession("easyshell-sess-down")
      mockSocketRequestError(
        Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
      )

      const caller = terminalSessionsRouter.createCaller({
        actor: "coordinator",
      })
      const result = await caller.exec({
        container_name: "easyshell-sess-down",
        command: "ls",
      })
      expect(result.status).toBe("error")
      if (result.status === "error") {
        expect(result.type).toBe("session_not_running")
      }
      const log = dbHolder
        .db!.prepare(
          "SELECT exit_status FROM command_log WHERE container_name=?",
        )
        .get("easyshell-sess-down") as { exit_status: string }
      expect(log.exit_status).toBe("container_down")
    })

    it("returns error/session_not_running and writes container_down log when no session row exists", async () => {
      const caller = terminalSessionsRouter.createCaller({
        actor: "coordinator",
      })
      const result = await caller.exec({
        container_name: "easyshell-sess-ghost",
        command: "ls",
      })
      expect(result.status).toBe("error")
      if (result.status === "error") {
        expect(result.type).toBe("session_not_running")
      }
      // http.request must NOT have been called — we shortcut on missing row.
      expect(httpRequestMock).not.toHaveBeenCalled()

      const log = dbHolder
        .db!.prepare(
          "SELECT exit_status, command FROM command_log WHERE container_name=?",
        )
        .get("easyshell-sess-ghost") as {
        exit_status: string
        command: string
      }
      expect(log).toEqual({ exit_status: "container_down", command: "ls" })
    })
  })

  describe("isRunning", () => {
    it("returns the running flag from dockerInspect", async () => {
      dockerState.inspect.mockResolvedValueOnce({ exists: true, running: true })
      const caller = terminalSessionsRouter.createCaller({
        actor: "coordinator",
      })
      const result = await caller.isRunning({
        container_name: "easyshell-sess-1",
      })
      expect(result).toEqual({ is_running: true })
      expect(dockerState.inspect).toHaveBeenCalledWith("easyshell-sess-1")
    })

    it("returns is_running=false when container is missing or stopped", async () => {
      dockerState.inspect.mockResolvedValueOnce({
        exists: false,
        running: false,
      })
      const caller = terminalSessionsRouter.createCaller({
        actor: "coordinator",
      })
      const result = await caller.isRunning({ container_name: "ghost" })
      expect(result).toEqual({ is_running: false })
    })
  })

  describe("kill", () => {
    it("calls dockerKill, marks the job cancelled, and enqueues cleanup_pending", async () => {
      const now = Date.now()
      const containerName = "easyshell-sess-kill"
      dbHolder
        .db!.prepare(
          `INSERT INTO accepted_job (job_id, container_name, image, mode, status, accepted_at) VALUES (?,?,?,?,?,?)`,
        )
        .run(
          `session-${containerName}`,
          containerName,
          "easyshell-foo",
          "session",
          "running",
          now,
        )
      dbHolder
        .db!.prepare(
          `INSERT INTO container (container_name, job_id, docker_state, working_dir, created_at) VALUES (?,?,?,?,?)`,
        )
        .run(containerName, `session-${containerName}`, "running", "/tmp", now)

      dockerState.kill.mockResolvedValue({ ok: true })

      const caller = terminalSessionsRouter.createCaller({
        actor: "coordinator",
      })
      const result = await caller.kill({ container_name: containerName })
      expect(result).toEqual({ ok: true })
      expect(dockerState.kill).toHaveBeenCalledWith(containerName)

      const job = dbHolder
        .db!.prepare(
          "SELECT status, finished_at FROM accepted_job WHERE container_name=?",
        )
        .get(containerName) as { status: string; finished_at: number | null }
      expect(job.status).toBe("cancelled")
      expect(job.finished_at).toBeGreaterThan(0)

      const container = dbHolder
        .db!.prepare(
          "SELECT docker_state FROM container WHERE container_name=?",
        )
        .get(containerName) as { docker_state: string }
      expect(container.docker_state).toBe("removed")

      const pending = dbHolder
        .db!.prepare(
          "SELECT reason FROM cleanup_pending WHERE container_name=?",
        )
        .get(containerName) as { reason: string }
      expect(pending.reason).toBe("cancelled")
    })

    it("is idempotent — kill on a container that's already gone still returns ok:true", async () => {
      const containerName = "easyshell-sess-already-dead"
      dbHolder
        .db!.prepare(
          `INSERT INTO accepted_job (job_id, container_name, image, mode, status, accepted_at) VALUES (?,?,?,?,?,?)`,
        )
        .run(
          `session-${containerName}`,
          containerName,
          "easyshell-foo",
          "session",
          "running",
          Date.now(),
        )
      dockerState.kill.mockResolvedValue({
        ok: false,
        error: "No such container",
      })

      const caller = terminalSessionsRouter.createCaller({
        actor: "coordinator",
      })
      const result = await caller.kill({ container_name: containerName })
      expect(result).toEqual({ ok: true })
      const job = dbHolder
        .db!.prepare("SELECT status FROM accepted_job WHERE container_name=?")
        .get(containerName) as { status: string }
      expect(job.status).toBe("cancelled")
    })
  })
})
