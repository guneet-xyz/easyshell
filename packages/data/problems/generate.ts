import { PROJECT_ROOT, writeJsonToJs } from "@easyshell/utils/build"

import {
  GeneratedProblemConfigData,
  GeneratedProblemData,
  ProblemConfigSchema,
  TestcaseSchema,
} from "./schema"

import { readFile, readdir } from "fs/promises"

const PROBLEMS_DIR = `${PROJECT_ROOT}/packages/data/problems/_data`
const PROBLEMS_DIR_RELATIVE = `./_data`
const GENERATED_JS = `${PROJECT_ROOT}/packages/data/problems/generated.js`
const GENERATED_CONFIG_JS = `${PROJECT_ROOT}/packages/data/problems/generated.config.js`

async function _problemConfig(problem: string) {
  const parse_result = ProblemConfigSchema.safeParse(
    (
      (await import(`${PROBLEMS_DIR_RELATIVE}/${problem}/config`)) as {
        default: unknown
      }
    ).default,
  )

  if (!parse_result.success) {
    console.error(parse_result.error)
    throw new Error("Invalid problem config")
  }

  const config = parse_result.data
  if (config.slug !== problem) {
    throw new Error(`Problem slug does not match`)
  }

  return config
}

async function _problemBody(slug: string): Promise<string> {
  const path = `${PROBLEMS_DIR}/${slug}/page.md`
  return await readFile(path, { encoding: "utf8" })
}

export async function _problemHints(slug: string): Promise<string[]> {
  const hintsDir = `${PROBLEMS_DIR}/${slug}/hints`
  const files = await readdir(hintsDir).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return []
      throw error
    },
  )
  const hints: string[] = []
  for (const file of files) {
    hints.push(await readFile(`${hintsDir}/${file}`, { encoding: "utf8" }))
  }
  return hints
}

export async function generateProblemsData() {
  const problemSlugs = await readdir(PROBLEMS_DIR)

  const problems: GeneratedProblemData = []

  for (const problemSlug of problemSlugs) {
    const problem = await _problemConfig(problemSlug)
    const body = await _problemBody(problemSlug)
    const hints = await _problemHints(problemSlug)

    problems.push({
      id: problem.id,
      slug: problem.slug,
      title: problem.title,
      description: problem.description,
      tags: problem.tags,
      difficulty: problem.difficulty,
      body: body,
      hints: hints,
      testcases: problem.testcases.map((t) => TestcaseSchema.parse(t)),
    })
  }

  await writeJsonToJs(GENERATED_JS, problems)
}

export async function generateProblemConfigData() {
  const problemSlugs = await readdir(PROBLEMS_DIR)

  const problems: GeneratedProblemConfigData = []

  for (const problemSlug of problemSlugs) {
    const problem = await _problemConfig(problemSlug)
    problems.push(problem)
  }

  await writeJsonToJs(GENERATED_CONFIG_JS, problems)
}
