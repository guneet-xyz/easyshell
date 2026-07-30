// ====================================================
// Utility exports that are available during build time
// (can also be used in problem configs)
// ====================================================
import { sleep } from "."

import { $ } from "execa"

import { readFile, readdir, stat, writeFile } from "fs/promises"
import { join } from "path"

let _PROJECT_ROOT = process.env.PROJECT_ROOT

if (!_PROJECT_ROOT) {
  try {
    _PROJECT_ROOT = $.sync`git rev-parse --show-toplevel`.stdout
  } catch (e) {
    throw Error("Not a git repository")
  }
}

export const PROJECT_ROOT = _PROJECT_ROOT
export const PROBLEMS_DIR = `${PROJECT_ROOT}/packages/data/problems/_data`
export const WIKI_DIR = `${PROJECT_ROOT}/packages/data/wiki/_data`

export async function writeJsonToJs(path: string, data: unknown) {
  await writeFile(
    path,
    `
const data = ${JSON.stringify(data)}
export default data
`,
  )
}

export async function getFs(
  path: string,
): Promise<Record<string, string | null>> {
  const entries = await readdir(path, { recursive: true })
  const fs: Record<string, string | null> = {}
  for (const entry of entries) {
    const full = join(path, entry)
    const st = await stat(full)
    if (st.isFile()) {
      fs[entry] = (await readFile(full)).toString()
    }
  }
  return fs
}

export function testcaseDir(problemSlug: string, testcaseId: number): string {
  return `${PROBLEMS_DIR}/${problemSlug}/testcases/${testcaseId}`
}

export async function lastModified(path: string): Promise<number> {
  try {
    const result = await $`git log -1 --format=%at -- ${path}`
    const raw = result.stdout.trim()
    if (raw) {
      const seconds = parseInt(raw, 10)
      if (!Number.isNaN(seconds) && seconds > 0) {
        return seconds * 1000
      }
    }
  } catch {
    // fall through to fallback
  }
  if (process.env.CI) {
    throw new Error(`lastModified: git log returned empty for ${path} in CI`)
  }
  const st = await stat(path)
  return st.mtime.getTime()
}

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
      for (const dep of t.dependsOn ?? []) {
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
