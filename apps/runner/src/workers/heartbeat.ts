import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client"

import { createLogger } from "@easyshell/logger"

import { env } from "../env"
import {
  emitBlockedStillLog,
  getBackoffMs,
  onAuthReject,
  onAuthSuccess,
  onNonAuthError,
} from "../services/auth-state"

const log = createLogger("runner:heartbeat")

// In-memory draining flag — set to true when coordinator sends "drain"
let draining = false

export function isDraining(): boolean {
  return draining
}

export type CapacitySnapshot = {
  session_used: number
  session_max: number
  submission_used: number
  submission_max: number
}

function is401(err: unknown): boolean {
  if (!(err instanceof TRPCClientError)) return false
  const data = err.data as { httpStatus?: number; code?: string } | null
  return data?.httpStatus === 401 || data?.code === "UNAUTHORIZED"
}

/**
 * Sends a heartbeat to the coordinator every 5 seconds.
 * The heartbeat includes the current capacity snapshot.
 *
 * Coordinator can respond with:
 * - "ack" → normal, continue
 * - "drain" → stop accepting new jobs but finish in-flight
 * - "deregister" → drain + exit 0
 */
export async function heartbeatLoop(
  getCapacity: () => CapacitySnapshot,
): Promise<void> {
  const runnerId = env.RUNNER_ID
  const runnerToken = env.RUNNER_TOKEN

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = createTRPCClient<any>({
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

  const heartbeatMutate = (
    client as unknown as {
      runners: {
        heartbeat: {
          mutate: (input: {
            capacity: CapacitySnapshot
          }) => Promise<{ status: "ack" | "drain" | "deregister" }>
        }
      }
    }
  ).runners.heartbeat.mutate

  log.info({ runner_id: runnerId }, "runner.heartbeat.loop-started")

  while (true) {
    await new Promise((r) => setTimeout(r, getBackoffMs(5_000)))
    await emitBlockedStillLog()
    try {
      const capacity = getCapacity()
      const response = await heartbeatMutate({
        capacity: {
          session_used: capacity.session_used,
          session_max: capacity.session_max,
          submission_used: capacity.submission_used,
          submission_max: capacity.submission_max,
        },
      })

      onAuthSuccess()

      if (response.status === "drain") {
        log.warn("runner.heartbeat.draining — coordinator requested drain")
        draining = true
      } else if (response.status === "deregister") {
        log.warn(
          "runner.heartbeat.deregistering — coordinator requested deregister",
        )
        draining = true
        // Wait for in-flight jobs to complete (simplified: just exit after a short drain window)
        setTimeout(() => process.exit(0), 30_000)
      } else {
        log.debug({ runner_id: runnerId }, "runner.heartbeat.ack")
      }
    } catch (err) {
      if (is401(err)) {
        await onAuthReject()
      } else {
        onNonAuthError()
        log.warn(
          { error: err instanceof Error ? err.message : String(err) },
          "runner.heartbeat.failed — will retry",
        )
      }
    }
  }
}
