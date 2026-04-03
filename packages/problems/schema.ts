import { z } from "zod"

const FsSchema = z.record(z.union([z.string(), z.null()]))
export type FsType = z.infer<typeof FsSchema>

// ========================== Shared field schemas =============================

const SlugSchema = z
  .string()
  .refine((val) => RegExp(/^[a-z0-9\-]*[a-z0-9]$/).test(val))

const TitleSchema = z
  .string()
  .nonempty()
  .refine((val) => !val.startsWith(" "))
  .refine((val) => !val.endsWith(" "))

const TagSchema = z
  .string()
  .nonempty()
  .refine((val) => !val.startsWith(" "))
  .refine((val) => !val.endsWith(" "))

const TagsSchema = z.array(TagSchema).default([])

const DifficultySchema = z.enum(["easy", "medium", "hard"])

const TestcaseSchema = z.object({
  id: z.number().positive(),
  public: z.boolean().default(false),
  expected_stdout: z.string().optional(),
  expected_stderr: z.string().optional(),
  expected_exit_code: z.number().optional(),
  expected_fs: FsSchema.optional(),
  daemonSetup: z
    .function()
    .args(
      z.object({
        image_dir: z.string(),
        testcase_dir: z.string(),
        problem_dir: z.string(),
      }),
    )
    .returns(z.promise(z.string()))
    .optional(),
})

const TestSchema = z.object({
  testcase: z.union([
    z.number().positive(),
    z.literal("all"),
    z.array(z.number().positive()),
  ]),
  input: z.string(),
  pass: z.boolean(),
})

const CheckConfigSchema = z.object({
  totalPoints: z.number().positive(),
})

// ========================== Problem Config schemas ============================
// Uses a discriminated union on `type` field.
// Standard problems have testcases + tests.
// Live-environment problems have check config (setup.sh + check.sh).

const StandardProblemConfigSchema = z
  .object({
    type: z.literal("standard").default("standard"),
    id: z.number(),
    slug: SlugSchema,
    title: TitleSchema,
    description: z.string().nonempty(),
    difficulty: DifficultySchema,
    tags: TagsSchema,
    testcases: z.array(TestcaseSchema),
    tests: z.array(TestSchema).optional(),
  })
  .strict()

const LiveEnvironmentProblemConfigSchema = z
  .object({
    type: z.literal("live-environment"),
    id: z.number(),
    slug: SlugSchema,
    title: TitleSchema,
    description: z.string().nonempty(),
    difficulty: DifficultySchema,
    tags: TagsSchema,
    check: CheckConfigSchema,
  })
  .strict()

/**
 * Parse a problem config. Handles backward compatibility by defaulting
 * `type` to "standard" when not present.
 */
export const ProblemConfigSchema = z.preprocess(
  (val) => {
    // Backward compat: existing configs don't have `type` field.
    // Default to "standard" so the discriminated union works.
    if (val && typeof val === "object" && !("type" in val)) {
      return { ...val, type: "standard" }
    }
    return val
  },
  z.discriminatedUnion("type", [
    StandardProblemConfigSchema,
    LiveEnvironmentProblemConfigSchema,
  ]),
)

export type ProblemConfig = z.infer<typeof ProblemConfigSchema>

/**
 * Input type for standard problem configs (before Zod parsing).
 * Allows `type` to be omitted for backward compatibility with existing configs.
 */
export type StandardProblemConfigInput = Omit<
  StandardProblemConfig,
  "type" | "tags"
> & {
  type?: "standard"
  tags?: string[]
}

/**
 * Input type for live-environment problem configs (before Zod parsing).
 */
export type LiveEnvironmentProblemConfigInput = Omit<
  LiveEnvironmentProblemConfig,
  "tags"
> & {
  tags?: string[]
}

/**
 * Union input type for problem configs before Zod parsing.
 * This is what config.ts files should use for their type annotation.
 */
export type ProblemConfigInput =
  | StandardProblemConfigInput
  | LiveEnvironmentProblemConfigInput

// ========================== Problem Info schemas =============================
// Subset of config shipped to the website and submission-manager at runtime.
// Strips build-only fields (tests, daemonSetup).

const TestcaseInfoSchema = z.object({
  id: z.number().positive(),
  public: z.boolean().default(false),
  expected_stdout: z.string().optional(),
  expected_stderr: z.string().optional(),
  expected_exit_code: z.number().optional(),
  expected_fs: FsSchema.optional(),
})

const StandardProblemInfoSchema = z.object({
  type: z.literal("standard").default("standard"),
  id: z.number(),
  slug: SlugSchema,
  title: TitleSchema,
  description: z.string().nonempty(),
  difficulty: DifficultySchema,
  tags: TagsSchema,
  testcases: z.array(TestcaseInfoSchema),
})

const LiveEnvironmentProblemInfoSchema = z.object({
  type: z.literal("live-environment"),
  id: z.number(),
  slug: SlugSchema,
  title: TitleSchema,
  description: z.string().nonempty(),
  difficulty: DifficultySchema,
  tags: TagsSchema,
  check: CheckConfigSchema,
})

export const ProblemInfoSchema = z.preprocess(
  (val) => {
    if (val && typeof val === "object" && !("type" in val)) {
      return { ...val, type: "standard" }
    }
    return val
  },
  z.discriminatedUnion("type", [
    StandardProblemInfoSchema,
    LiveEnvironmentProblemInfoSchema,
  ]),
)

export type ProblemInfo = z.infer<typeof ProblemInfoSchema>

// ========================== Type guards ======================================

export type StandardProblemInfo = z.infer<typeof StandardProblemInfoSchema>
export type LiveEnvironmentProblemInfo = z.infer<
  typeof LiveEnvironmentProblemInfoSchema
>
export type StandardProblemConfig = z.infer<typeof StandardProblemConfigSchema>
export type LiveEnvironmentProblemConfig = z.infer<
  typeof LiveEnvironmentProblemConfigSchema
>

type HasType = { type: string }

export function isStandardProblem<T extends HasType>(
  problem: T,
): problem is T & { type: "standard" } {
  return problem.type === "standard"
}

export function isLiveEnvironmentProblem<T extends HasType>(
  problem: T,
): problem is T & { type: "live-environment" } {
  return problem.type === "live-environment"
}
