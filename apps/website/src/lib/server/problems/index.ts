import { getProblem, getProblemSlugs } from "@easyshell/data/problems"
import type { Problem } from "@easyshell/data/problems/schema"

import { getUserSubmissionStats } from "@/lib/server/queries"
import { getSeriesForProblem } from "@/lib/server/series"

export async function getProblemInfo(problem: string): Promise<Problem> {
  return getProblem(problem)
}

export async function getProblems() {
  return getProblemSlugs()
}

export { getProblemSlugFromId } from "@easyshell/data/problems"

export async function getPublicProblemInfo(slug: string) {
  const info = getProblem(slug)
  return {
    id: info.id,
    slug: info.slug,
    title: info.title,
    description: info.description,
    difficulty: info.difficulty,
    tags: info.tags,
  }
}

export async function getPublicTestcaseInfo(slug: string) {
  const info = getProblem(slug)
  return info.testcases.map((tc) => ({
    id: tc.id,
    expected_stdout: tc.expected_stdout,
    expected_stderr: tc.expected_stderr,
    expected_fs: tc.expected_fs,
    expected_exit_code: tc.expected_exit_code,
  }))
}

export async function getProblemBody(slug: string): Promise<string> {
  return getProblem(slug).body
}

export async function getProblemHintBody(
  slug: string,
  hint: number,
): Promise<string> {
  const hintBody = getProblem(slug).hints[hint - 1]
  if (hintBody === undefined) throw new Error("Hint not found")
  return hintBody
}

export async function getProblemHintCount(slug: string): Promise<number> {
  return getProblem(slug).hints.length
}

export async function getProblemDifficulty(slug: string) {
  const info = await getProblemInfo(slug)
  return info.difficulty
}

export async function getProblemStatus(slug: string, userId: string) {
  const stats = await getUserSubmissionStats(userId)
  return stats.problems[slug]
}

export async function getProblemMetadata(slug: string): Promise<{
  tags: Array<string>
  series: Array<{ slug: string; name: string }>
}> {
  const tags = (await getProblemInfo(slug)).tags
  const series = await getSeriesForProblem(slug)

  return {
    tags,
    series,
  }
}

export async function getAllTags() {
  const tags = new Set<string>()
  for (const problem of await getProblems()) {
    const info = await getProblemInfo(problem)
    for (const tag of info.tags) {
      tags.add(tag)
    }
  }
  return Array.from(tags)
}
