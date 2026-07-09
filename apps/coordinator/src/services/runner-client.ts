// ==========================================
// runner-client.ts — typed wrapper around @trpc/client for talking to a
// runner from the coordinator side.
//
// The runner's full AppRouter type is NOT imported here. coordinator and
// runner have a mutual type dependency (runner imports coordinator's
// AppRouter for jobs.reportResult, coordinator imports runner's
// AppRouter for jobs.accept/get/cancel). Importing both would create a
// circular type graph that breaks `tsc --noEmit` for both packages.
//
// We follow the same pattern used by `apps/runner/src/workers/push-retry.ts`:
// cast `createTRPCClient<any>` to a hand-rolled minimal procedure shape
// that mirrors the runner's `jobs.*` router. Keep this in sync with
// `apps/runner/src/schemas.ts`.
// ==========================================

import { createTRPCClient, httpBatchLink } from "@trpc/client"
import { eq } from "drizzle-orm"

import { runners } from "@easyshell/db/schema"

import { db } from "../db"
import { decryptSecret } from "./secret"

// ─── Procedure shapes (mirrors apps/runner/src/schemas.ts) ─────────────────

export type AcceptJobInput = {
  job_id: string
  container_name: string
  mode: "session" | "submission"
  image: string
  input?: string
  resource_limits?: { memory: string; cpus: string }
}

export type AcceptJobOutput =
  | { status: "accepted" }
  | { status: "at_capacity" }
  | { status: "duplicate" }

export type GetJobOutput =
  | { status: "unknown" }
  | { status: "accepted" }
  | { status: "running" }
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

// Mirrors apps/runner/src/schemas.ts for terminalSessions.*. The runner's
// exec error union includes `container_locked` which the coordinator must
// map onto its own `session_error` discriminant before returning to the
// website (the coordinator schema intentionally omits it).
export type CreateSessionInput = { container_name: string; image: string }
export type CreateSessionOutput = { ok: true }

export type ExecSessionInput = { container_name: string; command: string }
export type ExecSessionOutput =
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

export type IsRunningInput = { container_name: string }
export type IsRunningOutput = { is_running: boolean }

export type KillSessionInput = { container_name: string }
export type KillSessionOutput = { ok: true }

export type RunnerJobsClient = {
  jobs: {
    accept: { mutate: (input: AcceptJobInput) => Promise<AcceptJobOutput> }
    get: { query: (input: { job_id: string }) => Promise<GetJobOutput> }
    cancel: {
      mutate: (input: {
        job_id: string
      }) => Promise<{ ok: true; was_running: boolean }>
    }
  }
  terminalSessions: {
    create: {
      mutate: (input: CreateSessionInput) => Promise<CreateSessionOutput>
    }
    exec: { mutate: (input: ExecSessionInput) => Promise<ExecSessionOutput> }
    isRunning: { query: (input: IsRunningInput) => Promise<IsRunningOutput> }
    kill: { mutate: (input: KillSessionInput) => Promise<KillSessionOutput> }
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createRunnerClientFromCreds(
  publicUrl: string,
  secret: string,
  runnerId: string,
): RunnerJobsClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = createTRPCClient<any>({
    links: [
      httpBatchLink({
        url: publicUrl,
        headers: {
          Authorization: `Bearer ${secret}`,
          "x-coordinator-runner-id": runnerId,
        },
      }),
    ],
  })
  return raw as unknown as RunnerJobsClient
}

/**
 * Loads the runner row from DB, decrypts its secret with COORDINATOR_SECRET_KEY,
 * and returns a typed tRPC client bound to that runner.
 */
export async function createRunnerClientFromDb(
  runnerId: string,
): Promise<RunnerJobsClient> {
  const row = await db
    .select({
      publicUrl: runners.publicUrl,
      secretCiphertext: runners.secretCiphertext,
      secretNonce: runners.secretNonce,
      revokedAt: runners.revokedAt,
    })
    .from(runners)
    .where(eq(runners.id, runnerId))
    .limit(1)
  const runner = row[0]
  if (!runner) throw new Error(`Runner ${runnerId} not found`)
  if (runner.revokedAt) throw new Error(`Runner ${runnerId} is revoked`)
  const secret = decryptSecret(runner.secretCiphertext, runner.secretNonce)
  return createRunnerClientFromCreds(runner.publicUrl, secret, runnerId)
}
