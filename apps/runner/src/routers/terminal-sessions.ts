// ==========================================
// terminalSessions.* — Coordinator → Runner (session-mode dispatch)
//
// Implements the four session-lifecycle procedures:
//
//   create    → launches the entrypoint container in session mode and
//               registers the accepted_job + container + terminal_session
//               rows. Returns synchronously after `docker run -d` succeeds.
//
//   exec      → POSTs a command to the entrypoint's unix socket at
//               {WORKING_DIR}/sessions/{container}/main.sock, writes a
//               command_log row, and surfaces the typed result/error.
//
//   isRunning → `docker inspect --format {{.State.Running}}` wrapper.
//
//   kill      → docker container kill + mark accepted_job cancelled +
//               flip container to removed + enqueue cleanup_pending.
//
// Container names are ALWAYS provided by the coordinator (it owns the
// `easyshell-{uuid}` namespace) — the runner never generates them.
//
// Mirrors the original Go session-manager handlers under
// apps/session-manager/handlers/{create,exec,is-running,kill}/ but uses
// the typed argv adapter in docker/cli.ts (no `sh -c "docker ..."` shell
// interpolation, no injection surface).
// ==========================================

import fs from "node:fs"
import http from "node:http"
import path from "node:path"
import { initTRPC, TRPCError } from "@trpc/server"
import type { z } from "zod"

import { createLogger } from "@easyshell/logger"

import { type Context } from "../context"
import { getDb } from "../db/sqlite"
import {
  dockerInspect,
  dockerKill,
  dockerRun,
  isSafeContainerName,
  SESSION_EXPIRES_LABEL,
} from "../docker/cli"
import { env } from "../env"
import {
  CreateSessionInputSchema,
  ExecSessionInputSchema,
  IsRunningInputSchema,
  KillSessionInputSchema,
  type CreateSessionOutputSchema,
  type ExecSessionOutputSchema,
  type IsRunningOutputSchema,
  type KillSessionOutputSchema,
} from "../schemas"
import { incrementSession } from "../services/capacity"
import { clearInFlight, markInFlight } from "../services/in-flight"
import { endSession } from "../services/session-lifecycle"

const log = createLogger("runner:terminal-sessions")

const t = initTRPC.context<Context>().create()
const router = t.router
const coordinatorProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.actor !== "coordinator") {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Coordinator credentials required",
    })
  }
  return next({ ctx })
})

// ─── Unix socket exec helper ─────────────────────────────────────────────────
//
// Mirrors apps/session-manager/handlers/exec/exec.go:51-110 — POST the raw
// command string to the entrypoint daemon and decode its JSON response.
// The entrypoint protocol (see packages/session-manager-client/types.ts) is:
//   200 OK  → body is JSON {"stdout": "...", "stderr": "..."}
//   423 Locked → another command is still running in this container
//   5xx     → container error (body may contain the entrypoint's message)
//
// All errors are returned as a typed discriminated union so the tRPC
// procedure can write a precise command_log row without a try/catch.

type SocketExecResult =
  | { status: "success"; stdout: string; stderr: string }
  | {
      status: "error"
      type:
        | "took_too_long"
        | "session_not_running"
        | "session_error"
        | "container_locked"
      message: string
    }

/** Session containers live this long, matching the website's session expiry. */
const SESSION_LIFETIME_MS = 60 * 60 * 1000
/** Upper bound for one exec response from a session daemon. */
const MAX_EXEC_RESPONSE_BYTES = 1024 * 1024
// Linux O_PATH (not exported by node:fs); same value on x86_64 and arm64.
const O_PATH = 0o10000000

/**
 * Open the session socket without following symlinks. The session directory
 * is writable by user code inside the container, so a planted symlink could
 * otherwise redirect the runner to another session's socket. The returned
 * descriptor is dialed through /proc/self/fd, so swapping the file after the
 * check cannot change what is connected.
 */
function openSessionSocket(socketPath: string): number | null {
  let fd: number
  try {
    fd = fs.openSync(socketPath, O_PATH | fs.constants.O_NOFOLLOW)
  } catch {
    return null
  }
  if (!fs.fstatSync(fd).isSocket()) {
    fs.closeSync(fd)
    return null
  }
  return fd
}

function execViaSocket(
  socketPath: string,
  command: string,
  timeoutMs: number,
): Promise<SocketExecResult> {
  return new Promise<SocketExecResult>((resolve) => {
    const fd = openSessionSocket(socketPath)
    if (fd === null) {
      resolve({
        status: "error",
        type: "session_not_running",
        message: "session socket unavailable",
      })
      return
    }
    let settled = false
    // Absolute deadline: an idle timeout alone lets a daemon replaced by user
    // code hold the request open by trickling bytes.
    let deadline: NodeJS.Timeout | undefined
    const settle = (result: SocketExecResult): void => {
      if (settled) return
      settled = true
      clearTimeout(deadline)
      fs.closeSync(fd)
      resolve(result)
    }

    const req = http.request(
      { socketPath: `/proc/self/fd/${fd}`, path: "/", method: "POST" },
      (res) => {
        const chunks: Buffer[] = []
        let received = 0
        res.on("data", (chunk: Buffer) => {
          received += chunk.length
          if (received > MAX_EXEC_RESPONSE_BYTES) {
            req.destroy()
            settle({
              status: "error",
              type: "session_error",
              message: "session response too large",
            })
            return
          }
          chunks.push(chunk)
        })
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8")
          if (res.statusCode === 423) {
            settle({
              status: "error",
              type: "container_locked",
              message: "session is locked",
            })
            return
          }
          if (res.statusCode !== 200) {
            settle({
              status: "error",
              type: "session_error",
              message:
                body || `container error (status ${res.statusCode ?? "?"})`,
            })
            return
          }
          try {
            const parsed = JSON.parse(body) as {
              stdout?: unknown
              stderr?: unknown
            }
            const stdout =
              typeof parsed.stdout === "string" ? parsed.stdout : ""
            const stderr =
              typeof parsed.stderr === "string" ? parsed.stderr : ""
            settle({ status: "success", stdout, stderr })
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            settle({
              status: "error",
              type: "session_error",
              message: `failed to parse response: ${msg}`,
            })
          }
        })
        res.on("error", (err) => {
          settle({
            status: "error",
            type: "session_error",
            message: `response stream error: ${err.message}`,
          })
        })
      },
    )

    deadline = setTimeout(() => {
      req.destroy()
      settle({
        status: "error",
        type: "took_too_long",
        message: "command timed out",
      })
    }, timeoutMs)

    req.on("error", (err) => {
      // ENOENT / ECONNREFUSED — the socket file isn't there or the
      // entrypoint daemon hasn't bound it yet. Either way the session is
      // not reachable.
      settle({
        status: "error",
        type: "session_not_running",
        message: err.message,
      })
    })

    req.write(command)
    req.end()
  })
}

// ─── SQLite row shapes ───────────────────────────────────────────────────────

type TerminalSessionRow = {
  socket_path: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Synthetic job_id used for session-mode rows. The coordinator currently
 * dispatches sessions via `terminalSessions.create` (which has no
 * `job_id` field), so the runner derives a stable one from the container
 * name. The `session-` prefix keeps these visually distinct from
 * submission-mode job ids during debugging.
 */
function sessionJobId(containerName: string): string {
  return `session-${containerName}`
}

function mapExitStatus(result: SocketExecResult): string {
  if (result.status === "success") return "ok"
  switch (result.type) {
    case "took_too_long":
      return "timeout"
    case "container_locked":
      return "locked"
    case "session_not_running":
      return "container_down"
    case "session_error":
      return "error"
  }
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const terminalSessionsRouter = router({
  create: coordinatorProcedure
    .input(CreateSessionInputSchema)
    .mutation(
      async ({ input }): Promise<z.infer<typeof CreateSessionOutputSchema>> => {
        const db = getDb(env.RUNNER_DB_PATH)
        const jobId = input.job_id ?? sessionJobId(input.container_name)
        const sessionDir = path.join(
          env.WORKING_DIR,
          "sessions",
          input.container_name,
        )
        const socketPath = path.join(sessionDir, "main.sock")
        if (!isSafeContainerName(input.container_name)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "invalid container name",
          })
        }
        fs.mkdirSync(sessionDir, { recursive: true })
        // The sandbox engine remaps container root to an unprivileged host
        // UID, which must be able to create the session socket here.
        fs.chmodSync(sessionDir, 0o777)

        const now = Date.now()

        // Until create settles, reconciliation leaves this job alone.
        markInFlight(jobId)
        try {
          // Insert accepted_job + container + terminal_session rows atomically.
          // Use INSERT OR IGNORE so a retried create on an existing container
          // is idempotent — the docker run below is also a no-op for an
          // already-running container (it'll fail with "name already in use"
          // which is surfaced as a normal docker-run failure).
          db.transaction(() => {
            db.prepare(
              `INSERT OR IGNORE INTO accepted_job
              (job_id, container_name, image, mode, status, accepted_at)
              VALUES (?,?,?,?,?,?)`,
            ).run(
              jobId,
              input.container_name,
              input.image,
              "session",
              "starting",
              now,
            )
            db.prepare(
              `INSERT OR IGNORE INTO container
              (container_name, job_id, docker_state, working_dir, created_at)
              VALUES (?,?,?,?,?)`,
            ).run(input.container_name, jobId, "starting", sessionDir, now)
            db.prepare(
              `INSERT OR IGNORE INTO terminal_session
              (container_name, job_id, socket_path, created_at)
              VALUES (?,?,?,?)`,
            ).run(input.container_name, jobId, socketPath, now)
          })()

          // docker run -d --rm --name {name} -m 64m --cpus 0.1
          //            -v {sessionDir}:/tmp/easyshell {image} -mode session
          const result = await dockerRun({
            containerName: input.container_name,
            image: input.image,
            mode: "session",
            // Problem daemons alone peak at 15-23 MiB at startup; 10m was
            // OOM-killed on some kernels.
            memory: "64m",
            cpus: "0.1",
            extraVolumes: [`${sessionDir}:/tmp/easyshell`],
            detach: true,
            labels: {
              [SESSION_EXPIRES_LABEL]: String(
                Math.floor((now + SESSION_LIFETIME_MS) / 1000),
              ),
            },
            // Covers pulling the testcase image from the registry.
            timeoutMs: 120_000,
          })

          if (result.exitCode !== 0) {
            db.prepare(
              "UPDATE accepted_job SET status='failed', error_message=?, finished_at=? WHERE job_id=? AND status='starting'",
            ).run(
              `docker run failed: ${result.stderr.slice(0, 500)}`,
              Date.now(),
              jobId,
            )
            db.prepare(
              "UPDATE container SET docker_state='removed' WHERE container_name=?",
            ).run(input.container_name)
            db.prepare(
              "INSERT OR IGNORE INTO cleanup_pending (container_name, reason, queued_at) VALUES (?,?,?)",
            ).run(input.container_name, "finished", Date.now())
            log.error(
              {
                container_name: input.container_name,
                exit_code: result.exitCode,
                stderr: result.stderr,
              },
              "terminal-session.create-failed",
            )
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `docker run failed: ${result.stderr}`,
            })
          }

          // Only if still starting: the session may have been killed while
          // its container was being pulled or created.
          const promoted = db
            .prepare(
              "UPDATE accepted_job SET status='running', started_at=? WHERE job_id=? AND status='starting'",
            )
            .run(now, jobId).changes
          if (promoted === 0) {
            await dockerKill(input.container_name)
            db.prepare(
              "INSERT OR IGNORE INTO cleanup_pending (container_name, reason, queued_at) VALUES (?,?,?)",
            ).run(input.container_name, "cancelled", Date.now())
            log.warn(
              { container_name: input.container_name },
              "terminal-session.ended-while-starting",
            )
            throw new TRPCError({
              code: "CONFLICT",
              message: "session ended while starting",
            })
          }
          db.prepare(
            "UPDATE container SET docker_state='running' WHERE container_name=?",
          ).run(input.container_name)
          incrementSession()

          log.info(
            { container_name: input.container_name },
            "terminal-session.created",
          )
          return { ok: true }
        } finally {
          clearInFlight(jobId)
        }
      },
    ),

  exec: coordinatorProcedure
    .input(ExecSessionInputSchema)
    .mutation(
      async ({ input }): Promise<z.infer<typeof ExecSessionOutputSchema>> => {
        const db = getDb(env.RUNNER_DB_PATH)
        const row = db
          .prepare(
            "SELECT socket_path FROM terminal_session WHERE container_name=?",
          )
          .get(input.container_name) as TerminalSessionRow | undefined

        const startedAt = Date.now()

        if (!row) {
          const finishedAt = Date.now()
          // Still write a command_log entry — the operator wants to see
          // the attempt even if we never reached the socket.
          db.prepare(
            `INSERT INTO command_log
              (container_name, command, stdout, stderr, started_at, finished_at, exit_status)
              VALUES (?,?,?,?,?,?,?)`,
          ).run(
            input.container_name,
            input.command,
            null,
            null,
            startedAt,
            finishedAt,
            "container_down",
          )
          return {
            status: "error",
            type: "session_not_running",
            message: "session not found",
          }
        }

        const result = await execViaSocket(row.socket_path, input.command, 5000)
        const finishedAt = Date.now()

        db.prepare(
          `INSERT INTO command_log
            (container_name, command, stdout, stderr, started_at, finished_at, exit_status)
            VALUES (?,?,?,?,?,?,?)`,
        ).run(
          input.container_name,
          input.command,
          result.status === "success" ? result.stdout : null,
          result.status === "success" ? result.stderr : null,
          startedAt,
          finishedAt,
          mapExitStatus(result),
        )
        db.prepare(
          "UPDATE terminal_session SET last_exec_at=? WHERE container_name=?",
        ).run(finishedAt, input.container_name)

        if (result.status === "success") {
          return {
            status: "success",
            stdout: result.stdout,
            stderr: result.stderr,
          }
        }
        return { status: "error", type: result.type, message: result.message }
      },
    ),

  isRunning: coordinatorProcedure
    .input(IsRunningInputSchema)
    .query(
      async ({ input }): Promise<z.infer<typeof IsRunningOutputSchema>> => {
        const inspect = await dockerInspect(input.container_name)
        return { is_running: inspect.running }
      },
    ),

  kill: coordinatorProcedure
    .input(KillSessionInputSchema)
    .mutation(
      async ({ input }): Promise<z.infer<typeof KillSessionOutputSchema>> => {
        const db = getDb(env.RUNNER_DB_PATH)
        // docker container kill is idempotent at the cli adapter level —
        // it returns ok:false if the container is already gone but does
        // not throw. We swallow that and continue to the SQLite updates
        // because the desired terminal state is the same either way.
        await dockerKill(input.container_name)
        endSession(db, input.container_name, "cancelled", "cancelled")

        log.info(
          { container_name: input.container_name },
          "terminal-session.killed",
        )
        return { ok: true }
      },
    ),
})
