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

export function getProblem(id: string): Problem {
  const problem = parsedData.find((p) => p.id === id)
  if (!problem) throw new Error("Problem not found")
  return problem
}

export function getProblemIds(): Array<string> {
  return parsedData.map((p) => p.id)
}

export function getProblemConfigs(): GeneratedProblemConfigData {
  return parsedDataConfig
}

export function getProblemConfig(id: string): ProblemConfig {
  const problem = parsedDataConfig.find((p) => p.id === id)
  if (!problem) throw new Error("Problem not found")
  return problem
}
