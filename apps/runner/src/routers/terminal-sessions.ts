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
import { dockerInspect, dockerKill, dockerRun } from "../docker/cli"
import { env } from "../env"
import {
  CreateSessionInputSchema,
  type CreateSessionOutputSchema,
  ExecSessionInputSchema,
  type ExecSessionOutputSchema,
  IsRunningInputSchema,
  type IsRunningOutputSchema,
  KillSessionInputSchema,
  type KillSessionOutputSchema,
} from "../schemas"
import { decrementSession, incrementSession } from "../services/capacity"

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
      type: "took_too_long" | "session_not_running" | "session_error" | "container_locked"
      message: string
    }

function execViaSocket(
  socketPath: string,
  command: string,
  timeoutMs: number,
): Promise<SocketExecResult> {
  return new Promise<SocketExecResult>((resolve) => {
    let settled = false
    const settle = (result: SocketExecResult): void => {
      if (settled) return
      settled = true
      resolve(result)
    }

    const req = http.request(
      { socketPath, path: "/", method: "POST" },
      (res) => {
        const chunks: Buffer[] = []
        res.on("data", (chunk: Buffer) => chunks.push(chunk))
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
              message: body || `container error (status ${res.statusCode ?? "?"})`,
            })
            return
          }
          try {
            const parsed = JSON.parse(body) as { stdout?: unknown; stderr?: unknown }
            const stdout = typeof parsed.stdout === "string" ? parsed.stdout : ""
            const stderr = typeof parsed.stderr === "string" ? parsed.stderr : ""
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

    req.setTimeout(timeoutMs, () => {
      req.destroy()
      settle({
        status: "error",
        type: "took_too_long",
        message: "command timed out",
      })
    })

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
        const jobId = sessionJobId(input.container_name)
        const sessionDir = path.join(env.WORKING_DIR, "sessions", input.container_name)
        const socketPath = path.join(sessionDir, "main.sock")
        fs.mkdirSync(sessionDir, { recursive: true })

        const now = Date.now()

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
          ).run(jobId, input.container_name, input.image, "session", "starting", now)
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

        // docker run -d --rm --name {name} -m 10m --cpus 0.1
        //            -v {sessionDir}:/tmp/easyshell {image} -mode session
        const result = await dockerRun({
          containerName: input.container_name,
          image: input.image,
          mode: "session",
          memory: "10m",
          cpus: "0.1",
          extraVolumes: [`${sessionDir}:/tmp/easyshell`],
          detach: true,
        })

        if (result.exitCode !== 0) {
          db.prepare(
            "UPDATE accepted_job SET status='failed', error_message=? WHERE job_id=?",
          ).run(`docker run failed: ${result.stderr.slice(0, 500)}`, jobId)
          db.prepare(
            "UPDATE container SET docker_state='removed' WHERE container_name=?",
          ).run(input.container_name)
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

        db.prepare(
          "UPDATE accepted_job SET status='running', started_at=? WHERE job_id=?",
        ).run(now, jobId)
        db.prepare(
          "UPDATE container SET docker_state='running' WHERE container_name=?",
        ).run(input.container_name)
        incrementSession()

        log.info({ container_name: input.container_name }, "terminal-session.created")
        return { ok: true }
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
          return { status: "success", stdout: result.stdout, stderr: result.stderr }
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
        const jobId = sessionJobId(input.container_name)

        // docker container kill is idempotent at the cli adapter level —
        // it returns ok:false if the container is already gone but does
        // not throw. We swallow that and continue to the SQLite updates
        // because the desired terminal state is the same either way.
        await dockerKill(input.container_name)

        db.prepare(
          "UPDATE accepted_job SET status='cancelled', finished_at=? WHERE job_id=?",
        ).run(Date.now(), jobId)
        db.prepare(
          "UPDATE container SET docker_state='removed' WHERE container_name=?",
        ).run(input.container_name)
        db.prepare(
          "INSERT OR IGNORE INTO cleanup_pending (container_name, reason, queued_at) VALUES (?,?,?)",
        ).run(input.container_name, "cancelled", Date.now())
        decrementSession()

        log.info({ container_name: input.container_name }, "terminal-session.killed")
        return { ok: true }
      },
    ),
})
