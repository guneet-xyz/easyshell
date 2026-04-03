import { $ } from "execa"

import { getProblemInfo, getProblems } from "@easyshell/problems"
import { isStandardProblem } from "@easyshell/problems/schema"

import { env } from "../env"
import { RunParallelStuff, Task } from "./_utils"

async function dockerPush(tag: string) {
  if (!env.DOCKER_REGISTRY) return
  const registry = env.DOCKER_REGISTRY
  await $`docker tag ${tag} ${registry}/easyshell/${tag}`
  await $`docker push ${registry}/easyshell/${tag}`
}

async function pushProblemTasks(problem: string): Promise<Array<Task>> {
  const tasks: Array<Task> = []
  const info = await getProblemInfo(problem)

  if (!isStandardProblem(info)) {
    // Live-environment: single image with sentinel testcaseId=1
    const tag = `easyshell-${problem}-1`
    tasks.push({
      name: `push-${tag}`,
      callable: async () => {
        if (!env.DOCKER_REGISTRY) return "skipped"
        await dockerPush(tag)
        return "done"
      },
    })
    return tasks
  }

  for (const testcase of info.testcases) {
    const tag = `easyshell-${problem}-${testcase.id}`
    tasks.push({
      name: `push-${tag}`,
      callable: async () => {
        if (!env.DOCKER_REGISTRY) return "skipped"
        await dockerPush(tag)
        return "done"
      },
    })
  }
  return tasks
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.error(
      "Provide a problem slug to push. Provide 'all' to push all problems.",
    )
    process.exit(1)
  }
  if (args.length > 1) {
    console.error("Too many arguments")
    process.exit(1)
  }
  const arg = args[0]!

  const push_tasks: Array<Task> = []

  const problems = await getProblems()
  if (arg === "all") {
    for (const problem of problems)
      push_tasks.push(...(await pushProblemTasks(problem)))
  } else {
    if (!problems.includes(arg)) {
      console.error(`Problem not found: ${arg}`)
      process.exit(1)
    }
    push_tasks.push(...(await pushProblemTasks(arg)))
  }

  console.log(
    "=================================== Pushing ====================================",
  )
  console.log()
  await RunParallelStuff({
    tasks: push_tasks,
    parallel_limit: env.PARALLEL_LIMIT,
  })
  console.log(
    "================================================================================",
  )
  console.log()
  console.log("All Done!")
}

await main()
