// ==========================================
// push-retry worker
//
// Every 10s, scans the SQLite `accepted_job` table for terminal-status rows
// (succeeded|failed|cancelled) that have not yet been ack'd by the
// Coordinator (push_acked=0), and replays them via jobs.reportResult.
//
// On success: marks push_acked=1.
// On non-401 non-2xx failure: bumps push_attempts and stamps last_push_at;
//   the row will be retried on the next tick.
// On 401 (auth reject): stops the batch immediately, does NOT bump
//   push_attempts on any row (401 says "your credential is bad", not "this
//   row is broken"). Backoff cadence is driven by services/auth-state.
//
// The coordinator's tRPC AppRouter is NOT imported here. Cross-package type
// import causes a circular dep (coordinator depends on runner's AppRouter
// type via @easyshell/runner/client and vice versa). We follow the same
// pattern used by heartbeat.ts: typed inline cast on
// `createTRPCClient<any>`.
// ==========================================

import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client"

import { createLogger } from "@easyshell/logger"

import { getDb } from "../db/sqlite"
import { env } from "../env"
import {
  emitBlockedStillLog,
  getBackoffMs,
  onAuthReject,
  onAuthSuccess,
  onNonAuthError,
} from "../services/auth-state"

const log = createLogger("runner:push-retry")

const LOOP_INTERVAL_MS = 10_000
const BATCH_SIZE = 10

// ─── Result shape mirrors coordinator.schemas.ReportResultInput.outcome ──────

type ReportResultPayload =
  | {
      status: "succeeded"
      stdout: string
      stderr: string
      exit_code: number
      fs: Record<string, string>
      started_at: string
      finished_at: string
    }
  | { status: "failed"; error: string }
  | { status: "cancelled" }

type ReportResultClient = {
  jobs: {
    reportResult: {
      mutate: (input: {
        job_id: string
        outcome: ReportResultPayload
      }) => Promise<{ acked: true }>
    }
  }
}

type PendingRow = {
  job_id: string
  status: string
  stdout: string | null
  stderr: string | null
  exit_code: number | null
  fs: string | null
  error_message: string | null
  started_at: number | null
  finished_at: number | null
}

let coordinatorClient: ReportResultClient | null = null

function getCoordinatorClient(): ReportResultClient {
  if (coordinatorClient) return coordinatorClient

  const runnerId = env.RUNNER_ID
  const runnerToken = env.RUNNER_TOKEN

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = createTRPCClient<any>({
    links: [
      httpBatchLink({
        url: env.COORDINATOR_URL,
        headers: {
          Authorization: `Bearer ${runnerToken}`,
          "x-runner-id": runnerId,
        },
      }),
    ],
  })
  coordinatorClient = raw as unknown as ReportResultClient
  return coordinatorClient
}

function is401(err: unknown): boolean {
  if (!(err instanceof TRPCClientError)) return false
  const data = err.data as { httpStatus?: number; code?: string } | null
  return data?.httpStatus === 401 || data?.code === "UNAUTHORIZED"
}

function rowToPayload(row: PendingRow): ReportResultPayload {
  if (row.status === "succeeded") {
    const startedIso = row.started_at
      ? new Date(row.started_at).toISOString()
      : new Date().toISOString()
    const finishedIso = row.finished_at
      ? new Date(row.finished_at).toISOString()
      : new Date().toISOString()
    const fsMap = row.fs ? (JSON.parse(row.fs) as Record<string, string>) : {}
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
  if (row.status === "cancelled") return { status: "cancelled" }
  // status === "failed" (or any other terminal we don't recognize → failed)
  return { status: "failed", error: row.error_message ?? "unknown error" }
}

async function pushOnce(): Promise<void> {
  const client = getCoordinatorClient()

  const db = getDb(env.RUNNER_DB_PATH)
  const pending = db
    .prepare(
      `SELECT job_id, status, stdout, stderr, exit_code, fs,
              error_message, started_at, finished_at
         FROM accepted_job
        WHERE status IN ('succeeded','failed','cancelled')
          AND push_acked=0
        ORDER BY finished_at ASC
        LIMIT ?`,
    )
    .all(BATCH_SIZE) as PendingRow[]

  for (const row of pending) {
    try {
      const payload = rowToPayload(row)
      await client.jobs.reportResult.mutate({
        job_id: row.job_id,
        outcome: payload,
      })
      db.prepare("UPDATE accepted_job SET push_acked=1 WHERE job_id=?").run(
        row.job_id,
      )
      onAuthSuccess()
      log.info({ job_id: row.job_id }, "push.acked")
    } catch (err: unknown) {
      if (is401(err)) {
        // 401 aborts the batch: (a) do NOT bump push_attempts on this row
        // (auth-backoff is a credential concern, not a per-row retry-exhaustion
        // concern), (b) do NOT attempt subsequent rows (they'd all 401 too and
        // would spuriously bump every row's push_attempts counter).
        await onAuthReject()
        return
      }
      onNonAuthError()
      db.prepare(
        "UPDATE accepted_job SET push_attempts=push_attempts+1, last_push_at=? WHERE job_id=?",
      ).run(Date.now(), row.job_id)
      log.warn(
        {
          job_id: row.job_id,
          error: err instanceof Error ? err.message : String(err),
        },
        "push.failed",
      )
    }
  }
}

/**
 * Long-running loop. Never resolves under normal operation.
 *
 * Returns a promise so the caller can `.catch` on a fatal escape, but the
 * inner try/catch swallows per-iteration errors so a transient SQLite or
 * network failure never crashes the loop.
 */
export async function pushRetryLoop(): Promise<void> {
  log.info({ interval_ms: LOOP_INTERVAL_MS }, "runner.push-retry.loop-started")

  // eslint-disable-next-line no-constant-condition
  while (true) {
    await new Promise((r) => setTimeout(r, getBackoffMs(LOOP_INTERVAL_MS)))
    await emitBlockedStillLog()
    try {
      await pushOnce()
    } catch (err: unknown) {
      log.error(
        { error: err instanceof Error ? err.message : String(err) },
        "runner.push-retry.iteration-error",
      )
    }
  }
}
