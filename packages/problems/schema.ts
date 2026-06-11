import { z } from "zod"

const FsSchema = z.record(z.union([z.string(), z.null()]))
export type FsType = z.infer<typeof FsSchema>

export const ProblemConfigSchema = z
  .object({
    id: z.number(),
    slug: z.string().refine((val) => RegExp(/^[a-z0-9\-]*[a-z0-9]$/).test(val)),
    title: z
      .string()
      .nonempty()
      .refine((val) => !val.startsWith(" "))
      .refine((val) => !val.endsWith(" ")),
    description: z.string().nonempty(),
    difficulty: z.enum(["easy", "medium", "hard"]),
    tags: z
      .array(
        z
          .string()
          .nonempty()
          .refine((val) => !val.startsWith(" "))
          .refine((val) => !val.endsWith(" ")),
      )
      .default([]),
    testcases: z.array(
      z.object({
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
      }),
    ),
    tests: z
      .array(
        z.object({
          testcase: z.union([
            z.number().positive(),
            z.literal("all"),
            z.array(z.number().positive()),
          ]),
          input: z.string(),
          pass: z.boolean(),
        }),
      )
      .optional(),
  })
  .strict()

export type ProblemConfig = z.infer<typeof ProblemConfigSchema>

export const ProblemInfoSchema = z.object({
  id: z.number(),
  slug: z.string().refine((val) => RegExp(/^[a-z0-9\-]*[a-z0-9]$/).test(val)),
  title: z
    .string()
    .nonempty()
    .refine((val) => !val.startsWith(" "))
    .refine((val) => !val.endsWith(" ")),
  description: z.string().nonempty(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  tags: z
    .array(
      z
        .string()
        .nonempty()
        .refine((val) => !val.startsWith(" "))
        .refine((val) => !val.endsWith(" ")),
    )
    .default([]),
  testcases: z.array(
    z.object({
      id: z.number().positive(),
      public: z.boolean().default(false),
      expected_stdout: z.string().optional(),
      expected_stderr: z.string().optional(),
      expected_exit_code: z.number().optional(),
      expected_fs: FsSchema.optional(),
    }),
  ),
})

export type ProblemInfo = z.infer<typeof ProblemInfoSchema>
