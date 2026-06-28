import { z } from "zod"

// ─── Shared primitives ───────────────────────────────────────────────────────

export const ExecutionModeSchema = z.enum(["session", "submission"])
export const RunnerStatusSchema = z.enum(["active", "draining", "stale", "deregistered"])
export const JobStatusSchema = z.enum([
  "dispatched",
  "accepted",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "lost",
])

// ─── runners.* ───────────────────────────────────────────────────────────────

export const RegisterRunnerInputSchema = z.object({
  name: z.string().min(1).max(255),
  public_url: z.string().url(),
  region: z.string().max(64).optional(),
  labels: z.record(z.string()).default({}),
  version: z.string().max(64).optional(),
  capabilities: z
    .array(
      z.object({
        mode: ExecutionModeSchema,
        concurrency: z.number().int().positive(),
      }),
    )
    .min(1),
})
export const RegisterRunnerOutputSchema = z.object({
  runner_id: z.string(),
  runner_secret: z.string(),
})

export const HeartbeatInputSchema = z.object({
  capacity: z.object({
    session_used: z.number().int().nonnegative(),
    session_max: z.number().int().nonnegative(),
    submission_used: z.number().int().nonnegative(),
    submission_max: z.number().int().nonnegative(),
  }),
})
export const HeartbeatOutputSchema = z.object({
  status: z.enum(["ack", "drain", "deregister"]),
})

export const DeregisterInputSchema = z.object({})
export const DeregisterOutputSchema = z.object({ ok: z.literal(true) })

// ─── jobs.* (Runner → Coordinator push) ──────────────────────────────────────

export const ReportResultInputSchema = z.object({
  job_id: z.string(),
  outcome: z.discriminatedUnion("status", [
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
  ]),
})
export const ReportResultOutputSchema = z.object({ acked: z.literal(true) })

export const ReportProgressInputSchema = z.object({
  job_id: z.string(),
  state: z.enum(["accepted", "starting", "running"]),
  detail: z.string().optional(),
})
export const ReportProgressOutputSchema = z.object({ acked: z.literal(true) })

// ─── terminalSessions.* (Website → Coordinator) ───────────────────────────────

export const CreateTerminalSessionInputSchema = z.object({
  terminal_session_id: z.number().int().positive(),
  image: z.string().min(1),
})
export const CreateTerminalSessionOutputSchema = z.object({
  container_name: z.string(),
  runner_id: z.string(),
})

export const ExecTerminalSessionInputSchema = z.object({
  terminal_session_id: z.number().int().positive(),
  command: z.string(),
})
export const ExecTerminalSessionOutputSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("success"), stdout: z.string(), stderr: z.string() }),
  z.object({
    status: z.literal("error"),
    type: z.enum([
      "took_too_long",
      "session_not_running",
      "session_error",
      "critical_server_error",
      "runner_unreachable",
    ]),
    message: z.string(),
  }),
])

export const IsAliveInputSchema = z.object({
  terminal_session_id: z.number().int().positive(),
})
export const IsAliveOutputSchema = z.object({ is_running: z.boolean() })

export const KillTerminalSessionInputSchema = z.object({
  terminal_session_id: z.number().int().positive(),
})
export const KillTerminalSessionOutputSchema = z.object({ ok: z.literal(true) })

export const GetRouteInputSchema = z.object({
  terminal_session_id: z.number().int().positive(),
})
export const GetRouteOutputSchema = z
  .object({
    runner_id: z.string(),
    container_name: z.string(),
  })
  .nullable()

// ─── submissions.* (Website → Coordinator) ────────────────────────────────────

export const EnqueueSubmissionInputSchema = z.object({
  user_id: z.string().min(1),
  problem_id: z.number().int().positive(),
  input: z.string(),
})
export const EnqueueSubmissionOutputSchema = z.object({
  submission_id: z.number().int().positive(),
  testcase_count: z.number().int().nonnegative(),
})

export const RetryTestcaseInputSchema = z.object({
  acting_user_id: z.string().min(1),
  submission_id: z.number().int().positive(),
  testcase_id: z.number().int().positive(),
})
export const RetryTestcaseOutputSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("queued") }),
  z.object({ status: z.literal("forbidden") }),
  z.object({ status: z.literal("not_found") }),
  z.object({ status: z.literal("not_failed") }),
])

export const RetryAllFailedInputSchema = z.object({
  acting_user_id: z.string().min(1),
  submission_id: z.number().int().positive(),
})
export const RetryAllFailedOutputSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("queued"), requeued_count: z.number().int().nonnegative() }),
  z.object({ status: z.literal("forbidden") }),
  z.object({ status: z.literal("not_found") }),
])

export const GetStatusInputSchema = z.object({
  submission_id: z.number().int().positive(),
})
export const GetStatusOutputSchema = z.object({
  submission_id: z.number().int().positive(),
  testcases: z.array(
    z.object({
      testcase_id: z.number().int().positive(),
      status: z.enum(["pending", "running", "finished", "failed", "cancelled"]),
      attempts: z.number().int().nonnegative(),
      last_error: z.string().nullable(),
      passed: z.boolean().nullable(),
    }),
  ),
})

// ─── health.* ────────────────────────────────────────────────────────────────

export const HealthPingInputSchema = z.object({})
export const HealthPingOutputSchema = z.object({
  ok: z.literal(true),
  version: z.string(),
})
