// ============================================================================
// Mustang API Client — typed HTTP wrapper for the Go mustang service.
// Pure HTTP layer with no database dependency.
// ============================================================================
import { z } from "zod"

// ================================ Logging =====================================

const log = (...args: unknown[]) => console.log("[mustang]", ...args)
const logError = (...args: unknown[]) => console.error("[mustang]", ...args)

// ================================ Constants ==================================

/** Default exec timeout (ms) when none is provided by the caller. */
const DEFAULT_EXEC_TIMEOUT_MS = 5_000
/** Extra headroom (ms) on the HTTP abort signal to account for container checks, chmod, and DB write. */
const SUBMIT_COMMAND_OVERHEAD_MS = 10_000

// ================================ Schemas ====================================

const CreateSessionRequestSchema = z.object({
  image: z.string(),
  problem: z.string(),
  testcase: z.number().int().default(0),
  mode: z.enum(["session", "submission", "warm"]),
  type: z.enum(["standard", "k3s"]),
  memory: z.string().optional(),
  cpu: z.string().optional(),
  privileged: z.boolean().optional(),
  tmpfs: z.array(z.string()).optional(),
  cgroupns: z.string().optional(),
  command: z.array(z.string()).optional(),
})

const CreateSessionResponseSchema = z.object({
  container_name: z.string(),
})

const SessionReadyResponseSchema = z.object({
  exists: z.boolean(),
  running: z.boolean(),
  ready: z.boolean(),
  error: z.string().optional(),
})

const ExecSessionResponseSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
})

const CheckSessionResponseSchema = z.object({
  score: z.number(),
  total: z.number(),
  percentage: z.number(),
  passed: z.boolean(),
  raw_output: z.string(),
})

const CreateSubmissionRequestSchema = z.object({
  image: z.string(),
  problem: z.string(),
  testcase: z.number().int().default(0),
  type: z.enum(["standard", "k3s"]),
  input_file_path: z.string().optional(),
  output_file_path: z.string().optional(),
  memory: z.string().optional(),
  cpu: z.string().optional(),
  privileged: z.boolean().optional(),
  tmpfs: z.array(z.string()).optional(),
  cgroupns: z.string().optional(),
  command: z.array(z.string()).optional(),
})

const CreateSubmissionResponseSchema = z.object({
  container_name: z.string(),
})

const StandardOutputSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exit_code: z.number(),
  fs: z.record(z.string()),
})

const ScoreResultSchema = z.object({
  score: z.number(),
  total: z.number(),
  percentage: z.number(),
  passed: z.boolean(),
  raw_output: z.string(),
})

const PollSubmissionResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("running"),
  }),
  z.object({
    status: z.literal("finished"),
    output: StandardOutputSchema.optional(),
    score: ScoreResultSchema.optional(),
  }),
])

// ========================= Container List Schemas ============================

const ContainerSchema = z.object({
  name: z.string(),
  labels: z.record(z.string()),
  created_at: z.string(),
  status: z.string(),
})

const ListContainersResponseSchema = z.object({
  containers: z.array(ContainerSchema),
})

const ClaimSessionResponseSchema = z.object({
  claimed: z.boolean(),
  error: z.string().optional(),
})

// =================== Higher-Level Endpoint Schemas ===========================

const TerminalSessionLogSchema = z.object({
  id: z.number(),
  stdin: z.string(),
  stdout: z.string(),
  stderr: z.string(),
  started_at: z.string(),
  finished_at: z.string(),
})

const GetOrCreateTerminalSessionResponseSchema = z.object({
  id: z.number(),
  container_name: z.string().nullable(),
  created_at: z.string(),
  expires_at: z.string(),
  ready: z.boolean(),
  logs: z.array(TerminalSessionLogSchema),
})

const KillTerminalSessionsResponseSchema = z.object({
  deleted_sessions: z.number(),
})

const SubmitCommandSuccessSchema = z.object({
  status: z.literal("success"),
  stdout: z.string(),
  stderr: z.string(),
  log_id: z.number(),
})

const SubmitCommandErrorSchema = z.object({
  status: z.literal("error"),
  type: z.enum([
    "took_too_long",
    "session_not_running",
    "session_error",
    "critical_server_error",
  ]),
  message: z.string(),
})

const SubmitCommandResponseSchema = z.discriminatedUnion("status", [
  SubmitCommandSuccessSchema,
  SubmitCommandErrorSchema,
])

const CleanupResponseSchema = z.object({
  cleaned: z.number(),
})

const RunSubmissionResponseSchema = z.object({
  started_at: z.string(),
  finished_at: z.string(),
  output: StandardOutputSchema,
  passed: z.boolean(),
})

// =============================== Types =======================================

export type CreateSessionRequest = z.input<typeof CreateSessionRequestSchema>
export type CreateSessionResponse = z.infer<typeof CreateSessionResponseSchema>
export type SessionReadyResponse = z.infer<typeof SessionReadyResponseSchema>
export type ExecSessionResponse = z.infer<typeof ExecSessionResponseSchema>
export type CheckSessionResponse = z.infer<typeof CheckSessionResponseSchema>

export type CreateSubmissionRequest = z.input<
  typeof CreateSubmissionRequestSchema
>
export type CreateSubmissionResponse = z.infer<
  typeof CreateSubmissionResponseSchema
>
export type StandardOutput = z.infer<typeof StandardOutputSchema>
export type ScoreResult = z.infer<typeof ScoreResultSchema>
export type PollSubmissionResponse = z.infer<
  typeof PollSubmissionResponseSchema
>

export type ContainerInfo = z.infer<typeof ContainerSchema>
export type ListContainersResponse = z.infer<
  typeof ListContainersResponseSchema
>
export type ClaimSessionResponse = z.infer<typeof ClaimSessionResponseSchema>

export type ListContainersFilters = {
  mode?: string
  problem?: string
  testcase?: number
}

export type ExecError = {
  status: "error"
  type:
    | "took_too_long"
    | "session_not_running"
    | "session_error"
    | "critical_server_error"
  message: string
}

export type ExecResult =
  | {
      status: "success"
      stdout: string
      stderr: string
    }
  | ExecError

// Higher-level endpoint types
export type TerminalSessionLog = z.infer<typeof TerminalSessionLogSchema>
export type GetOrCreateTerminalSessionResponse = z.infer<
  typeof GetOrCreateTerminalSessionResponseSchema
>
export type KillTerminalSessionsResponse = z.infer<
  typeof KillTerminalSessionsResponseSchema
>
export type SubmitCommandResponse = z.infer<typeof SubmitCommandResponseSchema>
export type CleanupResponse = z.infer<typeof CleanupResponseSchema>
export type RunSubmissionResponse = z.infer<typeof RunSubmissionResponseSchema>

// ============================== Client =======================================

export interface MustangClient {
  createSession(opts: CreateSessionRequest): Promise<CreateSessionResponse>
  getSessionReady(containerName: string): Promise<SessionReadyResponse>
  execSession(opts: {
    containerName: string
    command: string
    timeoutMs?: number
  }): Promise<ExecResult>
  killSession(containerName: string): Promise<void>
  checkSession(containerName: string): Promise<CheckSessionResponse>
  createSubmission(
    opts: CreateSubmissionRequest,
  ): Promise<CreateSubmissionResponse>
  pollSubmission(
    containerName: string,
    outputFilePath?: string,
  ): Promise<PollSubmissionResponse>
  listContainers(
    filters?: ListContainersFilters,
  ): Promise<ListContainersResponse>
  claimSession(containerName: string): Promise<ClaimSessionResponse>

  // Higher-level endpoints (absorb business logic from sessions.ts / submissions.ts)
  getOrCreateTerminalSession(opts: {
    userId: string
    problemId: number
    testcaseId: number
    problemSlug: string
    problemType: "standard" | "k3s"
  }): Promise<GetOrCreateTerminalSessionResponse>
  killTerminalSessions(opts: {
    userId: string
    problemId: number
    testcaseId: number
  }): Promise<KillTerminalSessionsResponse>
  submitTerminalCommand(opts: {
    sessionId: number
    containerName: string
    command: string
    timeoutMs?: number
  }): Promise<SubmitCommandResponse>
  cleanupExpiredSessions(): Promise<CleanupResponse>
  runSubmission(opts: {
    problemSlug: string
    testcaseId: number
    input: string
  }): Promise<RunSubmissionResponse>
}

export function createMustangClient(config: {
  baseUrl: string
  token: string
}): MustangClient {
  const { baseUrl, token } = config

  log(`client created (baseUrl=${baseUrl})`)

  const headers = () => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  })

  return {
    async createSession(opts) {
      const body = CreateSessionRequestSchema.parse(opts)
      log(
        `POST /session/create (image=${body.image}, problem=${body.problem}, type=${body.type}, mode=${body.mode})`,
      )
      const resp = await fetch(`${baseUrl}/session/create`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
      })
      if (!resp.ok) {
        const text = await resp.text()
        logError(`POST /session/create failed: ${resp.status} ${text}`)
        throw new Error(`Failed to create session: ${resp.status} ${text}`)
      }
      const result = CreateSessionResponseSchema.parse(await resp.json())
      log(`POST /session/create -> container_name=${result.container_name}`)
      return result
    },

    async getSessionReady(containerName) {
      log(`GET /session/ready (name=${containerName})`)
      const resp = await fetch(
        `${baseUrl}/session/ready?name=${encodeURIComponent(containerName)}`,
        {
          method: "GET",
          headers: headers(),
        },
      )
      if (!resp.ok) {
        const text = await resp.text()
        logError(`GET /session/ready failed: ${resp.status} ${text}`)
        throw new Error(`Failed to check ready: ${resp.status} ${text}`)
      }
      const result = SessionReadyResponseSchema.parse(await resp.json())
      log(
        `GET /session/ready -> exists=${result.exists} running=${result.running} ready=${result.ready}${result.error ? ` error=${result.error}` : ""}`,
      )
      return result
    },

    async execSession({ containerName, command, timeoutMs = 5000 }) {
      log(
        `POST /session/exec (name=${containerName}, command=${JSON.stringify(command.slice(0, 100))}, timeout=${timeoutMs}ms)`,
      )

      // Pre-flight: check if container is running
      const readyResult = await this.getSessionReady(containerName)
      if (!readyResult.exists || !readyResult.running) {
        logError(`POST /session/exec -> session not running`)
        return {
          status: "error" as const,
          type: "session_not_running" as const,
          message: "The session is not running",
        }
      }

      let resp: Response
      try {
        resp = await fetch(`${baseUrl}/session/exec`, {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({
            container_name: containerName,
            command,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        })
      } catch (e) {
        if (e instanceof Error && e.name === "TimeoutError") {
          logError(`POST /session/exec -> timeout after ${timeoutMs}ms`)
          return {
            status: "error" as const,
            type: "took_too_long" as const,
            message: "The command took too long to execute",
          }
        }
        if (e instanceof Error && e.name === "TypeError") {
          logError(`POST /session/exec -> fetch TypeError (service down?)`)
          return {
            status: "error" as const,
            type: "critical_server_error" as const,
            message: "Request Failed (mustang service might be down)",
          }
        }
        logError(`POST /session/exec -> unknown error: ${e}`)
        return {
          status: "error" as const,
          type: "critical_server_error" as const,
          message: "Request Failed",
        }
      }

      let json: unknown
      try {
        json = await resp.json()
      } catch {
        logError(`POST /session/exec -> failed to parse response JSON`)
        return {
          status: "error" as const,
          type: "critical_server_error" as const,
          message: "Failed to parse response from mustang service",
        }
      }

      if (resp.status === 423 /* LOCKED */) {
        logError(`POST /session/exec -> 423 locked`)
        return {
          status: "error" as const,
          type: "session_error" as const,
          message:
            "The session is locked because it is running another command",
        }
      }

      if (resp.status === 500) {
        logError(`POST /session/exec -> 500 error`)
        return {
          status: "error" as const,
          type: "session_error" as const,
          message: "The session encountered an error",
        }
      }

      const parsed = ExecSessionResponseSchema.safeParse(json)
      if (!parsed.success) {
        logError(
          `POST /session/exec -> response parse error: ${parsed.error.message}`,
        )
        return {
          status: "error" as const,
          type: "critical_server_error" as const,
          message: "Failed to parse response from mustang service",
        }
      }

      log(
        `POST /session/exec -> success (stdout=${parsed.data.stdout.length} bytes, stderr=${parsed.data.stderr.length} bytes)`,
      )
      return {
        status: "success" as const,
        stdout: parsed.data.stdout,
        stderr: parsed.data.stderr,
      }
    },

    async killSession(containerName) {
      log(`POST /session/kill (name=${containerName})`)
      const resp = await fetch(`${baseUrl}/session/kill`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ container_name: containerName }),
      })
      if (!resp.ok) {
        const text = await resp.text()
        logError(`POST /session/kill failed: ${resp.status} ${text}`)
        throw new Error(`Failed to kill session: ${resp.status} ${text}`)
      }
      log(`POST /session/kill -> ok`)
    },

    async checkSession(containerName) {
      log(`POST /session/check (name=${containerName})`)
      let resp: Response
      try {
        resp = await fetch(`${baseUrl}/session/check`, {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({ container_name: containerName }),
          signal: AbortSignal.timeout(30000),
        })
      } catch (e) {
        if (e instanceof Error && e.name === "TimeoutError") {
          logError(`POST /session/check -> timeout`)
          throw new Error("The check took too long to execute")
        }
        logError(`POST /session/check -> fetch error: ${e}`)
        throw new Error("Request failed (mustang service might be down)")
      }

      if (!resp.ok) {
        const text = await resp.text()
        logError(`POST /session/check failed: ${resp.status} ${text}`)
        throw new Error(`Check failed: ${text}`)
      }

      const result = CheckSessionResponseSchema.parse(await resp.json())
      log(
        `POST /session/check -> score=${result.score}/${result.total} passed=${result.passed}`,
      )
      return result
    },

    async createSubmission(opts) {
      const body = CreateSubmissionRequestSchema.parse(opts)
      log(
        `POST /submission/create (image=${body.image}, problem=${body.problem}, type=${body.type})`,
      )
      const resp = await fetch(`${baseUrl}/submission/create`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
      })
      if (!resp.ok) {
        const text = await resp.text()
        logError(`POST /submission/create failed: ${resp.status} ${text}`)
        throw new Error(`Failed to create submission: ${resp.status} ${text}`)
      }
      const result = CreateSubmissionResponseSchema.parse(await resp.json())
      log(`POST /submission/create -> container_name=${result.container_name}`)
      return result
    },

    async pollSubmission(containerName, outputFilePath) {
      log(
        `POST /submission/poll (name=${containerName}${outputFilePath ? `, output=${outputFilePath}` : ""})`,
      )
      const resp = await fetch(`${baseUrl}/submission/poll`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          container_name: containerName,
          ...(outputFilePath ? { output_file_path: outputFilePath } : {}),
        }),
      })
      if (!resp.ok) {
        const text = await resp.text()
        logError(`POST /submission/poll failed: ${resp.status} ${text}`)
        throw new Error(`Failed to poll submission: ${resp.status} ${text}`)
      }
      const result = PollSubmissionResponseSchema.parse(await resp.json())
      if (result.status === "running") {
        log(`POST /submission/poll -> status=running`)
      } else {
        log(
          `POST /submission/poll -> status=finished${result.output ? ` exit_code=${result.output.exit_code}` : ""}${result.score ? ` score=${result.score.score}/${result.score.total}` : ""}`,
        )
      }
      return result
    },

    async listContainers(filters) {
      const params = new URLSearchParams()
      if (filters?.mode) params.set("mode", filters.mode)
      if (filters?.problem) params.set("problem", filters.problem)
      if (filters?.testcase !== undefined)
        params.set("testcase", String(filters.testcase))

      const qs = params.toString()
      log(`GET /containers/list${qs ? `?${qs}` : ""}`)
      const resp = await fetch(
        `${baseUrl}/containers/list${qs ? `?${qs}` : ""}`,
        {
          method: "GET",
          headers: headers(),
        },
      )
      if (!resp.ok) {
        const text = await resp.text()
        logError(`GET /containers/list failed: ${resp.status} ${text}`)
        throw new Error(`Failed to list containers: ${resp.status} ${text}`)
      }
      const result = ListContainersResponseSchema.parse(await resp.json())
      log(`GET /containers/list -> ${result.containers.length} containers`)
      return result
    },

    async claimSession(containerName) {
      log(`POST /session/claim (name=${containerName})`)
      const resp = await fetch(`${baseUrl}/session/claim`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ container_name: containerName }),
      })
      if (!resp.ok) {
        const text = await resp.text()
        logError(`POST /session/claim failed: ${resp.status} ${text}`)
        throw new Error(`Failed to claim session: ${resp.status} ${text}`)
      }
      const result = ClaimSessionResponseSchema.parse(await resp.json())
      log(
        `POST /session/claim -> claimed=${result.claimed}${result.error ? ` error=${result.error}` : ""}`,
      )
      return result
    },

    // =========================================================================
    // Higher-level endpoints
    // =========================================================================

    async getOrCreateTerminalSession(opts) {
      log(
        `POST /terminal-session/get-or-create (user=${opts.userId}, problem=${opts.problemId}, testcase=${opts.testcaseId})`,
      )
      const resp = await fetch(`${baseUrl}/terminal-session/get-or-create`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          user_id: opts.userId,
          problem_id: opts.problemId,
          testcase_id: opts.testcaseId,
          problem_slug: opts.problemSlug,
          problem_type: opts.problemType,
        }),
      })
      if (!resp.ok) {
        const text = await resp.text()
        logError(
          `POST /terminal-session/get-or-create failed: ${resp.status} ${text}`,
        )
        throw new Error(
          `Failed to get or create terminal session: ${resp.status} ${text}`,
        )
      }
      let json: unknown
      try {
        json = await resp.json()
      } catch {
        logError(
          `POST /terminal-session/get-or-create -> failed to parse response JSON`,
        )
        throw new Error(
          `Failed to parse terminal session response: invalid JSON`,
        )
      }
      const parsed = GetOrCreateTerminalSessionResponseSchema.safeParse(json)
      if (!parsed.success) {
        logError(
          `POST /terminal-session/get-or-create -> response parse error: ${parsed.error.message}`,
        )
        throw new Error(
          `Failed to parse terminal session response: ${parsed.error.message}`,
        )
      }
      const result = parsed.data
      log(
        `POST /terminal-session/get-or-create -> id=${result.id} container=${result.container_name} ready=${result.ready}`,
      )
      return result
    },

    async killTerminalSessions(opts) {
      log(
        `POST /terminal-session/kill (user=${opts.userId}, problem=${opts.problemId}, testcase=${opts.testcaseId})`,
      )
      const resp = await fetch(`${baseUrl}/terminal-session/kill`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          user_id: opts.userId,
          problem_id: opts.problemId,
          testcase_id: opts.testcaseId,
        }),
      })
      if (!resp.ok) {
        const text = await resp.text()
        logError(`POST /terminal-session/kill failed: ${resp.status} ${text}`)
        throw new Error(
          `Failed to kill terminal sessions: ${resp.status} ${text}`,
        )
      }
      let json: unknown
      try {
        json = await resp.json()
      } catch {
        logError(`POST /terminal-session/kill -> failed to parse response JSON`)
        throw new Error(
          `Failed to parse kill terminal sessions response: invalid JSON`,
        )
      }
      const parsed = KillTerminalSessionsResponseSchema.safeParse(json)
      if (!parsed.success) {
        logError(
          `POST /terminal-session/kill -> response parse error: ${parsed.error.message}`,
        )
        throw new Error(
          `Failed to parse kill terminal sessions response: ${parsed.error.message}`,
        )
      }
      const result = parsed.data
      log(
        `POST /terminal-session/kill -> deleted_sessions=${result.deleted_sessions}`,
      )
      return result
    },

    async submitTerminalCommand(opts) {
      log(
        `POST /terminal-session/submit-command (session=${opts.sessionId}, container=${opts.containerName})`,
      )
      let resp: Response
      try {
        resp = await fetch(`${baseUrl}/terminal-session/submit-command`, {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({
            session_id: opts.sessionId,
            container_name: opts.containerName,
            command: opts.command,
            timeout_ms: opts.timeoutMs,
          }),
          signal: AbortSignal.timeout(
            (opts.timeoutMs ?? DEFAULT_EXEC_TIMEOUT_MS) +
              SUBMIT_COMMAND_OVERHEAD_MS,
          ),
        })
      } catch (e) {
        if (e instanceof Error && e.name === "TimeoutError") {
          logError(`POST /terminal-session/submit-command -> timeout`)
          return {
            status: "error" as const,
            type: "took_too_long" as const,
            message: "The command took too long to execute",
          }
        }
        if (e instanceof Error && e.name === "TypeError") {
          logError(
            `POST /terminal-session/submit-command -> fetch TypeError (service down?)`,
          )
          return {
            status: "error" as const,
            type: "critical_server_error" as const,
            message: "Request Failed (mustang service might be down)",
          }
        }
        logError(`POST /terminal-session/submit-command -> unknown error: ${e}`)
        return {
          status: "error" as const,
          type: "critical_server_error" as const,
          message: "Request Failed",
        }
      }
      if (!resp.ok) {
        const text = await resp.text()
        logError(
          `POST /terminal-session/submit-command failed: ${resp.status} ${text}`,
        )
        return {
          status: "error" as const,
          type: "critical_server_error" as const,
          message: `Failed to submit command: ${resp.status} ${text}`,
        }
      }
      let json: unknown
      try {
        json = await resp.json()
      } catch {
        logError(
          `POST /terminal-session/submit-command -> failed to parse response JSON`,
        )
        return {
          status: "error" as const,
          type: "critical_server_error" as const,
          message: "Failed to parse response from mustang service",
        }
      }
      const parsed = SubmitCommandResponseSchema.safeParse(json)
      if (!parsed.success) {
        logError(
          `POST /terminal-session/submit-command -> response parse error: ${parsed.error.message}`,
        )
        return {
          status: "error" as const,
          type: "critical_server_error" as const,
          message: "Failed to parse response from mustang service",
        }
      }
      const result = parsed.data
      if (result.status === "success") {
        log(
          `POST /terminal-session/submit-command -> success (log_id=${result.log_id})`,
        )
      } else {
        logError(
          `POST /terminal-session/submit-command -> error: ${result.type}`,
        )
      }
      return result
    },

    async cleanupExpiredSessions() {
      log(`POST /sessions/cleanup`)
      const resp = await fetch(`${baseUrl}/sessions/cleanup`, {
        method: "POST",
        headers: headers(),
      })
      if (!resp.ok) {
        const text = await resp.text()
        logError(`POST /sessions/cleanup failed: ${resp.status} ${text}`)
        throw new Error(
          `Failed to cleanup expired sessions: ${resp.status} ${text}`,
        )
      }
      const result = CleanupResponseSchema.parse(await resp.json())
      log(`POST /sessions/cleanup -> cleaned=${result.cleaned}`)
      return result
    },

    async runSubmission(opts) {
      log(
        `POST /submission/run (problem=${opts.problemSlug}, testcase=${opts.testcaseId})`,
      )
      const resp = await fetch(`${baseUrl}/submission/run`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          problem_slug: opts.problemSlug,
          testcase_id: opts.testcaseId,
          input: opts.input,
        }),
        // Long timeout: standard up to 2min, k3s up to 4min
        signal: AbortSignal.timeout(300_000),
      })
      if (!resp.ok) {
        const text = await resp.text()
        logError(`POST /submission/run failed: ${resp.status} ${text}`)
        throw new Error(`Failed to run submission: ${resp.status} ${text}`)
      }
      const result = RunSubmissionResponseSchema.parse(await resp.json())
      log(
        `POST /submission/run -> passed=${result.passed} exit_code=${result.output.exit_code}`,
      )
      return result
    },
  }
}
