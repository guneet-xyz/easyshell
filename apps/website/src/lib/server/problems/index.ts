import { getProblem, getProblemIds } from "@easyshell/data/problems"
import type { Problem } from "@easyshell/data/problems/schema"

import { getUserSubmissionStats } from "@/lib/server/queries"
import { getSeriesForProblem } from "@/lib/server/series"

export async function getProblemInfo(problem: string): Promise<Problem> {
  return getProblem(problem)
}

export async function getProblems() {
  return getProblemIds()
}

export async function getPublicProblemInfo(id: string) {
  const info = getProblem(id)
  return {
    id: info.id,
    title: info.title,
    description: info.description,
    difficulty: info.difficulty,
    tags: info.tags,
  }
}

export async function getPublicTestcaseInfo(id: string) {
  const info = getProblem(id)
  return info.testcases.map((tc) => ({
    id: tc.id,
    expected_stdout: tc.expected_stdout,
    expected_stderr: tc.expected_stderr,
    expected_fs: tc.expected_fs,
    expected_exit_code: tc.expected_exit_code,
  }))
}

export async function getProblemBody(id: string): Promise<string> {
  return getProblem(id).body
}

export async function getProblemHintBody(
  id: string,
  hint: number,
): Promise<string> {
  const hintBody = getProblem(id).hints[hint - 1]
  if (hintBody === undefined) throw new Error("Hint not found")
  return hintBody
}

export async function getProblemHintCount(id: string): Promise<number> {
  return getProblem(id).hints.length
}

export async function getProblemDifficulty(id: string) {
  const info = await getProblemInfo(id)
  return info.difficulty
}

export async function getProblemStatus(id: string, userId: string) {
  const stats = await getUserSubmissionStats(userId)
  return stats.problems[id]
}

export async function getProblemMetadata(id: string): Promise<{
  tags: Array<string>
  series: Array<{ id: string; name: string }>
}> {
  const tags = (await getProblemInfo(id)).tags
  const series = await getSeriesForProblem(id)

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
