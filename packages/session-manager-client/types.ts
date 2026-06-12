import { z } from "zod"

// POST /exec response
export const SessionManagerExecResponseSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
})
export type SessionManagerExecResponse = z.infer<typeof SessionManagerExecResponseSchema>

// POST /is-running response
export const SessionManagerIsRunningResponseSchema = z.object({
  is_running: z.boolean(),
})
export type SessionManagerIsRunningResponse = z.infer<typeof SessionManagerIsRunningResponseSchema>

// POST /run-submission metadata
export const RunSubmissionMetadataSchema = z.object({
  submission_id: z.number().int().positive(),
  testcase_id: z.number().int().positive(),
  problem_slug: z.string().min(1),
})
export type RunSubmissionMetadata = z.infer<typeof RunSubmissionMetadataSchema>

// POST /run-submission request
export const RunSubmissionRequestSchema = z.object({
  image: z.string().min(1),
  input: z.string(),
  metadata: RunSubmissionMetadataSchema,
})
export type RunSubmissionRequest = z.infer<typeof RunSubmissionRequestSchema>

// POST /run-submission 202 response
export const RunSubmissionPostResponseSchema = z.object({
  job_id: z.string(),
  container_name: z.string(),
})
export type RunSubmissionPostResponse = z.infer<typeof RunSubmissionPostResponseSchema>

// GET /run-submission/{id} — discriminated union
export const RunSubmissionGetResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("running") }),
  z.object({
    status: z.literal("done"),
    stdout: z.string(),
    stderr: z.string(),
    exit_code: z.number().int(),
    fs: z.record(z.string()),
    started_at: z.string(),
    finished_at: z.string(),
  }),
  z.object({
    status: z.literal("error"),
    error: z.string(),
  }),
])
export type RunSubmissionGetResponse = z.infer<typeof RunSubmissionGetResponseSchema>
export type RunSubmissionResultDone = Extract<RunSubmissionGetResponse, { status: "done" }>
export type RunSubmissionResultError = Extract<RunSubmissionGetResponse, { status: "error" }>
