import {
  RunSubmissionGetResponse,
  RunSubmissionGetResponseSchema,
  RunSubmissionPostResponseSchema,
  RunSubmissionRequest,
  SessionManagerExecResponseSchema,
  SessionManagerIsRunningResponseSchema,
} from "./types"

const HTTP_STATUS_LOCKED = 423
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500

export type SessionManagerExecResult =
  | { status: "success"; stdout: string; stderr: string }
  | {
      status: "error"
      type:
        | "took_too_long"
        | "session_not_running"
        | "session_error"
        | "critical_server_error"
      message: string
    }

export interface RunSubmissionOpts {
  pollIntervalMs?: number
  maxWaitMs?: number
  postRetries?: number
  postBackoffMs?: number
}

export function createSessionManagerClient(config: { url: string; token: string }) {
  const { url, token } = config
  const authHeader = { Authorization: `Bearer ${token}` }

  async function create(args: { container_name: string; image: string }): Promise<void> {
    const resp = await fetch(`${url}/create`, {
      method: "POST",
      headers: authHeader,
      body: JSON.stringify(args),
    })
    if (!resp.ok) throw new Error(await resp.text())
  }

  async function exec(args: {
    containerName: string
    command: string
  }): Promise<SessionManagerExecResult> {
    const running = await isRunning(args.containerName)
    if (!running)
      return { status: "error", type: "session_not_running", message: "The session is not running" }

    let resp: Response
    try {
      resp = await fetch(`${url}/exec`, {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify({ container_name: args.containerName, command: args.command }),
        signal: AbortSignal.timeout(5000),
      })
    } catch (e) {
      if (e instanceof Error && e.name === "TimeoutError")
        return { status: "error", type: "took_too_long", message: "The command took too long to execute" }
      if (e instanceof Error && e.name === "TypeError")
        return {
          status: "error",
          type: "critical_server_error",
          message: "Request Failed (session manager might be down)",
        }
      return { status: "error", type: "critical_server_error", message: "Request Failed" }
    }

    let json: unknown
    try {
      json = await resp.json()
    } catch {
      return {
        status: "error",
        type: "critical_server_error",
        message: "Failed to parse response from session manager",
      }
    }

    if (resp.status === HTTP_STATUS_LOCKED)
      return {
        status: "error",
        type: "session_error",
        message: "The session is locked because it is running another command",
      }
    if (resp.status === HTTP_STATUS_INTERNAL_SERVER_ERROR)
      return { status: "error", type: "session_error", message: "The session encountered an error" }

    const parsed = SessionManagerExecResponseSchema.safeParse(json)
    if (!parsed.success)
      return {
        status: "error",
        type: "critical_server_error",
        message: "Failed to parse response from session manager",
      }

    return { status: "success", stdout: parsed.data.stdout, stderr: parsed.data.stderr }
  }

  async function isRunning(containerName: string): Promise<boolean> {
    const resp = await fetch(`${url}/is-running`, {
      method: "POST",
      headers: authHeader,
      body: JSON.stringify({ container_name: containerName }),
    })
    if (!resp.ok) throw new Error(await resp.text())
    const body = SessionManagerIsRunningResponseSchema.parse(await resp.json())
    return body.is_running
  }

  async function kill(containerName: string): Promise<void> {
    const resp = await fetch(`${url}/kill`, {
      method: "POST",
      headers: authHeader,
      body: JSON.stringify({ container_name: containerName }),
    })
    if (!resp.ok) throw new Error(await resp.text())
  }

  async function runSubmission(
    req: RunSubmissionRequest,
  ): Promise<
    | { status: "accepted"; job_id: string; container_name: string }
    | { status: "at_capacity" }
  > {
    const resp = await fetch(`${url}/run-submission`, {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(5000),
    })
    if (resp.status === 503) return { status: "at_capacity" }
    if (!resp.ok) throw new Error(`POST /run-submission failed: ${resp.status} ${await resp.text()}`)
    const parsed = RunSubmissionPostResponseSchema.parse(await resp.json())
    return { status: "accepted", job_id: parsed.job_id, container_name: parsed.container_name }
  }

  async function getSubmissionResult(
    jobId: string,
  ): Promise<RunSubmissionGetResponse | { status: "not_found" }> {
    const resp = await fetch(`${url}/run-submission/${jobId}`, {
      method: "GET",
      headers: authHeader,
      signal: AbortSignal.timeout(5000),
    })
    if (resp.status === 404) return { status: "not_found" }
    if (!resp.ok)
      throw new Error(`GET /run-submission/${jobId} failed: ${resp.status} ${await resp.text()}`)
    return RunSubmissionGetResponseSchema.parse(await resp.json())
  }

  async function runSubmissionAndWait(
    req: RunSubmissionRequest,
    opts?: RunSubmissionOpts,
  ): Promise<
    Extract<RunSubmissionGetResponse, { status: "done" }> |
    Extract<RunSubmissionGetResponse, { status: "error" }>
  > {
    const {
      pollIntervalMs = 500,
      maxWaitMs = 60_000,
      postRetries = 3,
      postBackoffMs = 500,
    } = opts ?? {}

    let jobId: string | null = null
    let lastPostError: Error | null = null

    for (let attempt = 0; attempt < postRetries; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, postBackoffMs * Math.pow(2, attempt - 1)))
      }
      try {
        const result = await runSubmission(req)
        if (result.status === "at_capacity") {
          lastPostError = new Error("server at capacity")
          continue
        }
        jobId = result.job_id
        break
      } catch (e) {
        lastPostError = e instanceof Error ? e : new Error(String(e))
      }
    }

    if (!jobId) {
      throw lastPostError ?? new Error("Failed to submit job after retries")
    }

    const deadline = Date.now() + maxWaitMs
    let notFoundOnce = false

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, pollIntervalMs))
      const result = await getSubmissionResult(jobId)
      if (result.status === "not_found") {
        if (!notFoundOnce) {
          notFoundOnce = true
          await new Promise((r) => setTimeout(r, pollIntervalMs * 2))
          continue
        }
        throw new Error("session-manager lost the job (likely restarted)")
      }
      if (result.status === "done" || result.status === "error") {
        return result
      }
    }

    throw new Error(`submission did not complete in ${maxWaitMs}ms`)
  }

  return { create, exec, isRunning, kill, runSubmission, getSubmissionResult, runSubmissionAndWait }
}
