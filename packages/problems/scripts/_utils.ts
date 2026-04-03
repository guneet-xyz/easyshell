import { stat } from "fs/promises"

import { sleep } from "@easyshell/utils"

export async function assertDirExists(path: string) {
  try {
    const info = await stat(path)
    if (!info.isDirectory())
      throw Error(`Path ${path} exists but is not a directory`)
  } catch (e) {
    throw Error(`Directory ${path} does not exist`)
  }
}

export async function assertFileExists(path: string) {
  try {
    const info = await stat(path)
    if (!info.isFile()) throw Error(`Path ${path} exists but is not a file`)
  } catch (e) {
    throw Error(`File ${path} does not exist`)
  }
}

export type Task = {
  name: string
  callable: () => Promise<string | void>
  dependsOn?: string[]
}

export async function RunParallelStuff({
  tasks,
  parallel_limit,
}: {
  tasks: Array<Task>
  parallel_limit: number
}) {
  const task_name_set = new Set<string>(Array.from(tasks, (task) => task.name))
  if (task_name_set.size !== tasks.length) {
    console.error(tasks.map((task) => task.name))
    throw Error("Task names must be unique")
  }

  for (const task of tasks) {
    if (task.dependsOn) {
      for (const dep of task.dependsOn) {
        if (!task_name_set.has(dep)) {
          throw Error(`Task ${task.name} depends on non-existent task ${dep}`)
        }
      }
    }
  }

  console.log(
    `Going to run ${tasks.length} tasks with ${parallel_limit} parallel limit.\n`,
  )
  let running = 0
  const initiated = new Set<string>()
  const succeeded = new Set<string>()
  const failed = new Set<string>()

  function _task_wrapper(task: Task) {
    return async () => {
      const result = await task.callable()
      running--
      if (result) {
        process.stdout.write(`\r${task.name}: ${result}\n`)
        failed.add(task.name)
      } else {
        succeeded.add(task.name)
      }
      process.stdout.write(
        `\rProgress [ ${succeeded.size + failed.size} / ${tasks.length} ]`,
      )
    }
  }

  const promises = Array<Promise<void>>()

  while (initiated.size < tasks.length) {
    while (running >= parallel_limit) await sleep(100)
    running++
    let index = -1
    while (true) {
      index++
      if (index >= tasks.length) throw "Circular dependencies"
      const t = tasks[index]!
      if (initiated.has(t.name)) continue
      let can_run = true
      for (const dep of t.dependsOn || []) {
        if (failed.has(dep)) {
          failed.add(t.name)
          initiated.add(t.name)
          can_run = false
          break
        }
        if (!succeeded.has(dep)) {
          can_run = false
          break
        }
      }
      if (!can_run) continue
      break
    }

    initiated.add(tasks[index]!.name)
    promises.push(_task_wrapper(tasks[index]!)())
  }

  await Promise.all(promises)

  process.stdout.write("\r\x1b[2K\n")
}
