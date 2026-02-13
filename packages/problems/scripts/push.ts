import { env } from "@easyshell/env"
import { getProblemInfo, getProblems } from "@easyshell/problems"

import { RunParallelStuff, Task } from "./_utils"

import { $ } from "execa"

async function dockerPush(tag: string) {
  if (env.DOCKER_REGISTRY === "") return
  await $`docker tag ${tag} ${env.DOCKER_REGISTRY}/easyshell/${tag}`
  await $`docker push ${env.DOCKER_REGISTRY}/easyshell/${tag}`
}

async function pushProblemTasks(problem: string): Promise<Array<Task>> {
  const tasks: Array<Task> = []
  const info = await getProblemInfo(problem)
  for (const testcase of info.testcases) {
    const tag = `easyshell-${problem}-${testcase.id}`
    tasks.push({
      name: `push-${tag}`,
      callable: async () => {
        if (env.DOCKER_REGISTRY === "") return "skipped"
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
