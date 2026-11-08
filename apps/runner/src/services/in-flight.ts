/**
 * Submission jobs whose `docker run` this process is still awaiting. Their
 * own lifecycle (with its timeout) records the outcome, so reconciliation
 * must not mark them lost when their container exits and is removed.
 */
const inFlight = new Set<string>()

export function markSubmissionInFlight(jobId: string): void {
  inFlight.add(jobId)
}

export function clearSubmissionInFlight(jobId: string): void {
  inFlight.delete(jobId)
}

export function isSubmissionInFlight(jobId: string): boolean {
  return inFlight.has(jobId)
}
