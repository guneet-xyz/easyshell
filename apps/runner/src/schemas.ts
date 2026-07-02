import { z } from "zod"

// ─── jobs.* (Coordinator → Runner dispatch) ───────────────────────────────────

export const AcceptJobInputSchema = z.object({
  job_id: z.string(),
  container_name: z.string(),
  mode: z.enum(["session", "submission"]),
  image: z.string().min(1),
  input: z.string().optional(),
  resource_limits: z
    .object({
      memory: z.string().default("10m"),
      cpus: z.string().default("0.1"),
    })
    .default({ memory: "10m", cpus: "0.1" }),
})
export const AcceptJobOutputSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("accepted") }),
  z.object({ status: z.literal("at_capacity") }),
  z.object({ status: z.literal("duplicate") }),
])

export const GetJobInputSchema = z.object({ job_id: z.string() })
export const GetJobOutputSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("unknown") }),
  z.object({ status: z.literal("accepted") }),
  z.object({ status: z.literal("running") }),
  z.object({
    status: z.literal("succeeded"),
    stdout: z.string(),
    stderr: z.string(),
    exit_code: z.number().int(),
    fs: z.record(z.string()).default({}),
    started_at: z.string(),
    finished_at: z.string(),
  }),
  z.object({ status: z.literal("failed"), error: z.string() }),
  z.object({ status: z.literal("cancelled") }),
])

export const CancelJobInputSchema = z.object({ job_id: z.string() })
export const CancelJobOutputSchema = z.object({
  ok: z.literal(true),
  was_running: z.boolean(),
})

// ─── terminalSessions.* (Coordinator → Runner) ───────────────────────────────

export const CreateSessionInputSchema = z.object({
  container_name: z.string(),
  image: z.string().min(1),
})
export const CreateSessionOutputSchema = z.object({ ok: z.literal(true) })

export const ExecSessionInputSchema = z.object({
  container_name: z.string(),
  command: z.string(),
})
export const ExecSessionOutputSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("success"),
    stdout: z.string(),
    stderr: z.string(),
  }),
  z.object({
    status: z.literal("error"),
    type: z.enum([
      "took_too_long",
      "session_not_running",
      "session_error",
      "container_locked",
    ]),
    message: z.string(),
  }),
])

export const IsRunningInputSchema = z.object({ container_name: z.string() })
export const IsRunningOutputSchema = z.object({ is_running: z.boolean() })

export const KillSessionInputSchema = z.object({ container_name: z.string() })
export const KillSessionOutputSchema = z.object({ ok: z.literal(true) })

// ─── health.* ────────────────────────────────────────────────────────────────

export const HealthPingInputSchema = z.object({})
export const HealthPingOutputSchema = z.object({
  ok: z.literal(true),
  version: z.string(),
})

export const HealthCapacityInputSchema = z.object({})
export const HealthCapacityOutputSchema = z.object({
  session_used: z.number().int().nonnegative(),
  session_max: z.number().int().nonnegative(),
  submission_used: z.number().int().nonnegative(),
  submission_max: z.number().int().nonnegative(),
})
