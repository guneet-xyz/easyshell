import data from "./generated"
import dataConfig from "./generated.config"
import {
  GeneratedProblemConfigData,
  GeneratedProblemConfigDataSchema,
  GeneratedProblemData,
  GeneratedProblemDataSchema,
  Problem,
  ProblemConfig,
} from "./schema"

const parsedData = GeneratedProblemDataSchema.parse(data)
const parsedDataConfig = GeneratedProblemConfigDataSchema.parse(dataConfig)

export function getProblems(): GeneratedProblemData {
  return parsedData
}

export function getProblem(slug: string): Problem {
  const problem = parsedData.find((p) => p.slug === slug)
  if (!problem) throw new Error("Problem not found")
  return problem
}

export function getProblemSlugFromId(id: number): string {
  const problem = parsedData.find((p) => p.id === id)
  if (!problem) throw new Error("Problem not found")
  return problem.slug
}

export function getProblemSlugs(): Array<string> {
  return parsedData.map((p) => p.slug)
}

export function getProblemConfigs(): GeneratedProblemConfigData {
  return parsedDataConfig
}

export function getProblemConfig(slug: string): ProblemConfig {
  const problem = parsedDataConfig.find((p) => p.slug === slug)
  if (!problem) throw new Error("Problem not found")
  return problem
}
