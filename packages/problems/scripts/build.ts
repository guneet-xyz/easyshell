import { readdir } from "fs/promises"
import { $ } from "execa"

import { env } from "../env"
import { RunParallelStuff, Task } from "./_utils"

const CACHE_DIR = `${env.WORKING_DIR}/build-cache`

async function main() {
  const entries = await readdir(CACHE_DIR, { withFileTypes: true })
  const tags = entries.filter((e) => e.isDirectory()).map((e) => e.name)

  if (tags.includes("easyshell-base")) {
    console.log("Building easyshell-base ...")
    await $({
      stdio: "inherit",
    })`docker build -t easyshell-base ${CACHE_DIR}/easyshell-base`
  }

  const buildTasks: Task[] = tags
    .filter((t) => t !== "easyshell-base")
    .map((tag) => ({
      name: `build-${tag}`,
      callable: async () => {
        await $`docker build -t ${tag} ${CACHE_DIR}/${tag}`
        return
      },
    }))

  console.log(`\nBuilding ${buildTasks.length} problem images ...\n`)
  await RunParallelStuff({
    tasks: buildTasks,
    parallel_limit: env.PARALLEL_LIMIT,
  })
  console.log("\nAll Done!")
}

await main()
