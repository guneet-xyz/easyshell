// ==========================================
// jobs.* — Coordinator → Runner dispatch
//
// Implements the submission-mode lifecycle:
//
//   accept → enqueue the job, spawn the docker run in the background,
//            and return IMMEDIATELY ({status: accepted|at_capacity|duplicate}).
//            T20 will extend this to handle session-mode.
//
//   get    → return the current SQLite-backed status row mapped onto the
//            jobs.get discriminated union.
//
//   cancel → docker kill + mark the SQLite row cancelled. Reports back
//            whether the container was actually running.
//
// In-memory submission concurrency tracking is intentionally LOCAL to this
// module — T22 will replace it with the dedicated capacity service.
// Until then, `env.SUBMISSION_MAX_CONCURRENCY` is consulted directly here.
// ==========================================

import fs from "node:fs"
import path from "node:path"

import { initTRPC, TRPCError } from "@trpc/server"
import type { z } from "zod"

import { createLogger } from "@easyshell/logger"

import { type Context } from "../context"
import { getDb } from "../db/sqlite"
import { dockerKill, dockerRun } from "../docker/cli"
import { env } from "../env"
import {
  AcceptJobInputSchema,
  AcceptJobOutputSchema,
  CancelJobInputSchema,
  CancelJobOutputSchema,
  GetJobInputSchema,
  GetJobOutputSchema,
} from "../schemas"

const log = createLogger("runner:jobs")

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

// ─── In-memory capacity counter (T22 replaces with services/capacity.ts) ─────

let submissionConcurrencyUsed = 0

export function getSubmissionConcurrencyUsed(): number {
  return submissionConcurrencyUsed
}

// ─── SQLite row shapes (for narrowing better-sqlite3's `any` returns) ────────

type AcceptedJobRow = {
  job_id: string
  status: string
  stdout?: string | null
  stderr?: string | null
  exit_code?: number | null
  fs?: string | null
  error_message?: string | null
  started_at?: number | null
  finished_at?: number | null
}

type EntrypointOutput = {
  stdout?: string
  stderr?: string
  exit_code?: number
  fs?: Record<string, string>
}

// ─── Background submission runner ────────────────────────────────────────────
//
// Kicks off the docker run in a detached async IIFE. Does NOT await — the
// tRPC handler returns "accepted" immediately and this work continues in the
// background. All terminal state is written to SQLite; the push-retry worker
// is responsible for relaying it to the coordinator.

function runSubmissionJob(params: {
  jobId: string
  containerName: string
  image: string
  input: string
  memory: string
  cpus: string
}): void {
  const { jobId, containerName, image, input, memory, cpus } = params
  const db = getDb(env.RUNNER_DB_PATH)

  void (async () => {
    const containerDir = path.join(env.WORKING_DIR, "submissions", containerName)
    fs.mkdirSync(containerDir, { recursive: true })

    const inputPath = path.join(containerDir, "input.sh")
    const outputPath = path.join(containerDir, "output.json")

    try {
      fs.writeFileSync(inputPath, input, { mode: 0o600 })
      fs.writeFileSync(outputPath, "{}", { mode: 0o600 })

      // Transition: accepted → running. started_at is set ONCE here.
      db.prepare(
        "UPDATE accepted_job SET status='running', started_at=? WHERE job_id=?",
      ).run(Date.now(), jobId)
      db.prepare(
        "UPDATE container SET docker_state='running' WHERE container_name=?",
      ).run(containerName)

      const result = await dockerRun({
        containerName,
        image,
        mode: "submission",
        memory,
        cpus,
        extraVolumes: [`${inputPath}:/input.sh`, `${outputPath}:/output.json`],
      })

      const finishedAt = Date.now()

      if (result.exitCode !== 0) {
        const errMsg = `docker run failed (exit ${result.exitCode}): ${result.stderr.slice(
          0,
          500,
        )}`
        db.prepare(
          "UPDATE accepted_job SET status='failed', finished_at=?, error_message=? WHERE job_id=?",
        ).run(finishedAt, errMsg, jobId)
        log.warn(
          { job_id: jobId, exit_code: result.exitCode },
          "job.submission.failed",
        )
        return
      }

      // exitCode === 0 → parse the entrypoint's output.json.
      let out: EntrypointOutput
      try {
        out = JSON.parse(fs.readFileSync(outputPath, "utf8")) as EntrypointOutput
      } catch (parseErr: unknown) {
        const msg = parseErr instanceof Error ? parseErr.message : String(parseErr)
        db.prepare(
          "UPDATE accepted_job SET status='failed', finished_at=?, error_message=? WHERE job_id=?",
        ).run(finishedAt, `failed to parse output.json: ${msg}`, jobId)
        log.warn(
          { job_id: jobId, error: msg },
          "job.submission.output-parse-failed",
        )
        return
      }

      db.prepare(
        `UPDATE accepted_job SET
          status='succeeded', finished_at=?, exit_code=?, stdout=?, stderr=?, fs=?
          WHERE job_id=?`,
      ).run(
        finishedAt,
        out.exit_code ?? 0,
        out.stdout ?? "",
        out.stderr ?? "",
        JSON.stringify(out.fs ?? {}),
        jobId,
      )
      log.info({ job_id: jobId }, "job.submission.succeeded")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      db.prepare(
        "UPDATE accepted_job SET status='failed', finished_at=?, error_message=? WHERE job_id=?",
      ).run(Date.now(), message, jobId)
      log.error({ job_id: jobId, error: message }, "job.submission.error")
    } finally {
      // Decrement exactly once, after the docker run lifecycle is fully done.
      submissionConcurrencyUsed = Math.max(0, submissionConcurrencyUsed - 1)
      // Enqueue cleanup for the cleanup worker (T22) to GC the directory and
      // sweep any leftover container artifacts.
      db.prepare(
        "INSERT OR IGNORE INTO cleanup_pending (container_name, reason, queued_at) VALUES (?,?,?)",
      ).run(containerName, "finished", Date.now())
    }
  })().catch((err: unknown) => {
    // Belt-and-suspenders: the inner try/catch/finally should catch everything,
    // but if anything escapes (e.g. a finally-clause throw) we still want to log
    // it instead of triggering an unhandledRejection.
    log.error(
      {
        job_id: jobId,
        error: err instanceof Error ? err.message : String(err),
      },
      "job.submission.uncaught",
    )
  })
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const jobsRouter = router({
  accept: coordinatorProcedure
    .input(AcceptJobInputSchema)
    .mutation(
      async ({
        input,
      }): Promise<z.infer<typeof AcceptJobOutputSchema>> => {
        const db = getDb(env.RUNNER_DB_PATH)

        // 1. Idempotency: a previously-accepted job_id is a no-op.
        const existing = db
          .prepare("SELECT job_id FROM accepted_job WHERE job_id=?")
          .get(input.job_id) as { job_id: string } | undefined
        if (existing) {
          log.info({ job_id: input.job_id }, "job.accept.duplicate")
          return { status: "duplicate" }
        }

        // 2. Capacity gate — only submission mode is implemented in T19.
        //    Session mode (T20) will get its own counter.
        if (
          input.mode === "submission" &&
          submissionConcurrencyUsed >= env.SUBMISSION_MAX_CONCURRENCY
        ) {
          log.warn(
            {
              job_id: input.job_id,
              used: submissionConcurrencyUsed,
              max: env.SUBMISSION_MAX_CONCURRENCY,
            },
            "job.accept.at-capacity",
          )
          return { status: "at_capacity" }
        }

        // 3. Insert the accepted_job + container rows in a single transaction
        //    so the runner never has a container row without its parent job.
        const now = Date.now()
        const workingDir = path.join(
          env.WORKING_DIR,
          input.mode === "submission" ? "submissions" : "sessions",
          input.container_name,
        )
        db.transaction(() => {
          db.prepare(
            `INSERT INTO accepted_job
              (job_id, container_name, image, mode, input, status, accepted_at)
              VALUES (?,?,?,?,?,?,?)`,
          ).run(
            input.job_id,
            input.container_name,
            input.image,
            input.mode,
            input.input ?? null,
            "accepted",
            now,
          )
          db.prepare(
            `INSERT INTO container
              (container_name, job_id, docker_state, working_dir, created_at)
              VALUES (?,?,?,?,?)`,
          ).run(input.container_name, input.job_id, "starting", workingDir, now)
        })()

        // 4. Spawn the background runner. Increment BEFORE spawning so two
        //    parallel accepts can't both pass the capacity gate.
        if (input.mode === "submission") {
          submissionConcurrencyUsed++
          runSubmissionJob({
            jobId: input.job_id,
            containerName: input.container_name,
            image: input.image,
            input: input.input ?? "",
            memory: input.resource_limits.memory,
            cpus: input.resource_limits.cpus,
          })
        }
        // Session-mode dispatch happens in T20 (terminalSessions router).

        log.info(
          {
            job_id: input.job_id,
            container_name: input.container_name,
            mode: input.mode,
          },
          "job.accepted",
        )
        return { status: "accepted" }
      },
    ),

  get: coordinatorProcedure
    .input(GetJobInputSchema)
    .query(({ input }): z.infer<typeof GetJobOutputSchema> => {
      const db = getDb(env.RUNNER_DB_PATH)
      const row = db
        .prepare("SELECT * FROM accepted_job WHERE job_id=?")
        .get(input.job_id) as AcceptedJobRow | undefined

      if (!row) return { status: "unknown" }

      switch (row.status) {
        case "accepted":
          return { status: "accepted" }
        case "starting":
        case "running":
          return { status: "running" }
        case "succeeded": {
          // Both timestamps SHOULD be set when status='succeeded' — the
          // started_at fallback to "now" is a defensive no-op for a row that
          // was somehow promoted to succeeded without a started_at.
          const startedIso = row.started_at
            ? new Date(row.started_at).toISOString()
            : new Date().toISOString()
          const finishedIso = row.finished_at
            ? new Date(row.finished_at).toISOString()
            : new Date().toISOString()
          const fsMap = row.fs
            ? (JSON.parse(row.fs) as Record<string, string>)
            : {}
          return {
            status: "succeeded",
            stdout: row.stdout ?? "",
            stderr: row.stderr ?? "",
            exit_code: row.exit_code ?? 0,
            fs: fsMap,
            started_at: startedIso,
            finished_at: finishedIso,
          }
        }
        case "failed":
          return { status: "failed", error: row.error_message ?? "unknown error" }
        case "cancelled":
          return { status: "cancelled" }
        case "lost":
          // Treat reconciliation-flagged lost rows as failures from the
          // coordinator's perspective. T21 may revisit this.
          return {
            status: "failed",
            error: row.error_message ?? "container lost",
          }
        default:
          return { status: "unknown" }
      }
    }),

  cancel: coordinatorProcedure
    .input(CancelJobInputSchema)
    .mutation(
      async ({
        input,
      }): Promise<z.infer<typeof CancelJobOutputSchema>> => {
        const db = getDb(env.RUNNER_DB_PATH)
        const row = db
          .prepare(
            "SELECT status, container_name FROM accepted_job WHERE job_id=?",
          )
          .get(input.job_id) as
          | { status: string; container_name: string }
          | undefined

        if (!row) {
          log.info({ job_id: input.job_id }, "job.cancel.unknown")
          return { ok: true, was_running: false }
        }

        const wasRunning = row.status === "running" || row.status === "starting"
        await dockerKill(row.container_name)
        db.prepare(
          "UPDATE accepted_job SET status='cancelled' WHERE job_id=?",
        ).run(input.job_id)
        log.info(
          { job_id: input.job_id, was_running: wasRunning },
          "job.cancelled",
        )
        return { ok: true, was_running: wasRunning }
      },
    ),
})
