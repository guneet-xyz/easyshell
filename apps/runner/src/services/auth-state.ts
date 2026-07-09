import { createLogger } from "@easyshell/logger"

import { safePendingPushDepth } from "./queue-depth"

const log = createLogger("runner:auth-state")

const authState = { rejectStreak: 0, inBackoff: false }

function formatQueueDepth(d: number | "unknown"): string {
  return typeof d === "number" ? `queue depth: ${d} rows` : "queue depth: unknown"
}

export async function onAuthReject(): Promise<void> {
  authState.rejectStreak++
  if (authState.rejectStreak >= 5 && !authState.inBackoff) {
    authState.inBackoff = true
    const d = await safePendingPushDepth()
    log.error(
      `runner.auth.blocked — coordinator has rejected 5 consecutive requests; if you did not just rotate this runner's token, RUNNER_TOKEN in this container's env may be corrupted or out of sync with the coordinator. Pending push-retry ${formatQueueDepth(d)} waiting for token recovery. See: docs/deployment.md#post-revoke-rotation-lifecycle.`,
    )
  }
}

export function onAuthSuccess(): void {
  if (authState.inBackoff) {
    log.info("runner.auth.recovered")
  }
  authState.rejectStreak = 0
  authState.inBackoff = false
}

export function onNonAuthError(): void {
  // non-401 errors neither increment nor reset the auth streak
}

export function getBackoffMs(normalMs: number): number {
  return authState.inBackoff ? 60_000 : normalMs
}

export function resetAuthStateForTest(): void {
  authState.rejectStreak = 0
  authState.inBackoff = false
}

export async function emitBlockedStillLog(): Promise<void> {
  if (authState.inBackoff) {
    const d = await safePendingPushDepth()
    log.warn(
      `runner.auth.blocked-still — auth-blocked; pending push-retry ${formatQueueDepth(d)}.`,
    )
  }
}
