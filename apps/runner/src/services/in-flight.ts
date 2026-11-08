/**
 * Jobs whose `docker run` this process is still awaiting: submissions until
 * the run finishes, sessions until `create` has started the container. Their
 * own code path records the outcome, so reconciliation must not mark them
 * lost while their container is still being pulled, created or removed.
 */
const inFlight = new Set<string>()

export function markInFlight(jobId: string): void {
  inFlight.add(jobId)
}

export function clearInFlight(jobId: string): void {
  inFlight.delete(jobId)
}

export function isInFlight(jobId: string): boolean {
  return inFlight.has(jobId)
}
