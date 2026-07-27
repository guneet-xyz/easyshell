import autocannon, { Options, Request } from "autocannon"
import { getProblemInfo, getProblems } from "packages/problems"

import { existsSync, mkdirSync } from "fs"
import { writeFile } from "fs/promises"

const REPORTS_DIR = "reports"

if (!existsSync(REPORTS_DIR)) {
  mkdirSync(REPORTS_DIR)
}

const problems = await getProblems()

export const testcases = (
  await Promise.all(
    problems.map(async (problem) => {
      const info = await getProblemInfo(problem)
      return info.testcases.map((tc) => `${problem}-${tc.id}`)
    }),
  )
).flat()

export function randomTestcase() {
  const randomIndex = Math.floor(Math.random() * testcases.length)
  return testcases[randomIndex]!
}

export function uniqueContainerName() {
  const length = 20
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let result = ""
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length)
    result += charset[randomIndex]
  }
  return result
}

export async function RunAutocannon({
  title,
  requests,
  connections,
  amount,
  overallRate,
  initialContext,
  duration,
}: {
  title: string
  requests: Array<Request>
  connections?: number
  amount?: number
  overallRate?: number
  initialContext?: object
  duration?: number
}) {
  let opts: Options = { url: "http://localhost:8008", requests }
  if (duration) {
    opts.duration = duration
  }
  if (connections) {
    opts.connections = connections
  }
  if (amount) {
    opts.amount = amount
  }
  if (overallRate) {
    opts.overallRate = overallRate
  }
  if (initialContext) {
    opts.initialContext = initialContext
  }

  const instance = autocannon(opts)

  // @ts-ignore
  autocannon.track(instance)

  const report = await instance
  const file = `${REPORTS_DIR}/autocannon-${title}.json`
  await writeFile(file, JSON.stringify(report, null, 2))
}
