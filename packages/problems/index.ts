// =====================================================
// Problem utilities to be used in scripts at build time
// TODO: remove unused functions
// =====================================================
import { readdir, readFile, stat } from "fs/promises"

import { PROBLEMS_DIR } from "@easyshell/utils/build"

import {
  isStandardProblem,
  ProblemConfigSchema,
  type ProblemConfig,
  type ProblemInfo,
} from "./schema"

const PROBLEMS_IMPORT_DIR = "./data/problems"

/**
 * Read and return the problem config, making sure it is valid.
 */
async function _problemConfig(problem: string) {
  const parse_result = ProblemConfigSchema.safeParse(
    (
      (await import(`${PROBLEMS_IMPORT_DIR}/${problem}/config`)) as {
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

/**
 * Get the full problem config including build-only fields (tests, daemonSetup).
 * Only use this in build/test scripts, not at runtime.
 */
export async function getProblemConfig(
  problem: string,
): Promise<ProblemConfig> {
  return await _problemConfig(problem)
}

export async function getProblemInfo(problem: string): Promise<ProblemInfo> {
  const config = await _problemConfig(problem)
  // Strip build-only fields (tests, daemonSetup) to produce ProblemInfo
  if (config.type === "live-environment") {
    return {
      type: config.type,
      id: config.id,
      slug: config.slug,
      title: config.title,
      description: config.description,
      difficulty: config.difficulty,
      tags: config.tags,
      check: config.check,
      warmInstances: config.warmInstances,
    }
  }
  return {
    type: config.type,
    id: config.id,
    slug: config.slug,
    title: config.title,
    description: config.description,
    difficulty: config.difficulty,
    tags: config.tags,
    testcases: config.testcases.map((tc) => ({
      id: tc.id,
      public: tc.public,
      expected_stdout: tc.expected_stdout,
      expected_stderr: tc.expected_stderr,
      expected_exit_code: tc.expected_exit_code,
      expected_fs: tc.expected_fs,
      warmInstances: tc.warmInstances,
    })),
  }
}

export async function getProblems() {
  const problems = await readdir(PROBLEMS_DIR)
  return problems
}

export async function getProblemSlugFromId(problemId: number) {
  const problems = await getProblems()
  for (const problem of problems) {
    const info = await getProblemInfo(problem)
    if (info.id === problemId) {
      return info.slug
    }
  }
  throw new Error("Problem not found")
}

export async function getPublicProblemInfo(slug: string) {
  const info = await getProblemInfo(slug)
  return {
    id: info.id,
    slug: info.slug,
    title: info.title,
    description: info.description,
    tags: info.tags,
  }
}

export async function getPublicTestcaseInfo(slug: string) {
  const info = await getProblemInfo(slug)
  if (!isStandardProblem(info)) {
    return []
  }
  return info.testcases
    .filter((tc) => tc.public)
    .map((tc) => ({
      id: tc.id,
      expected_stdout: tc.expected_stdout,
      expected_stderr: tc.expected_stderr,
      expected_fs: tc.expected_fs,
      expected_exit_code: tc.expected_exit_code,
    }))
}

export async function getProblemBody(slug: string): Promise<string> {
  const path = `${PROBLEMS_DIR}/${slug}/page.md`
  return await readFile(path, { encoding: "utf8" })
}

export async function getProblemHintBody(
  slug: string,
  hint: number,
): Promise<string> {
  const path = `${PROBLEMS_DIR}/${slug}/hints/${hint}.md`
  return await readFile(path, { encoding: "utf8" })
}

export async function getProblemHintCount(slug: string): Promise<number> {
  try {
    if (!(await stat(`${PROBLEMS_DIR}/${slug}/hints`)).isDirectory()) return 0
  } catch {
    return 0
  }
  return (await readdir(`${PROBLEMS_DIR}/${slug}/hints`)).length
}
