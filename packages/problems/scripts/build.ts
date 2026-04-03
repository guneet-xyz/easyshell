import { cp, mkdir, rm, stat, writeFile } from "fs/promises"
import { $ } from "execa"

import {
  getProblemConfig,
  getProblemInfo,
  getProblems,
} from "@easyshell/problems"
import { isStandardProblem } from "@easyshell/problems/schema"
import { PROBLEMS_DIR, PROJECT_ROOT } from "@easyshell/utils/build"

import { env } from "../env"
import { RunParallelStuff, Task } from "./_utils"

const WORKING_DIR = `${env.WORKING_DIR}/build`
await rm(WORKING_DIR, { recursive: true, force: true })

async function dockerBuild({ tag, dir }: { tag: string; dir: string }) {
  await $`docker build -t ${tag} ${dir}`
}

async function init() {
  await mkdir(`${WORKING_DIR}/images/easyshell-base`, {
    recursive: true,
  })

  await cp(
    `${PROJECT_ROOT}/apps/entrypoint`,
    `${WORKING_DIR}/images/easyshell-base/entrypoint`,
    { recursive: true },
  )

  await writeFile(
    `${WORKING_DIR}/images/easyshell-base/Dockerfile`,
    `
FROM alpine:3.21 AS build

RUN apk add --no-cache go

COPY entrypoint /src/entrypoint

RUN go build -C /src/entrypoint -o /bin/entrypoint

FROM alpine:3.21 AS base

RUN apk add --no-cache zip jq curl grep

COPY --from=build /bin/entrypoint /entrypoint
`,
  )

  await dockerBuild({
    tag: "easyshell-base",
    dir: `${WORKING_DIR}/images/easyshell-base`,
  })
}

async function _existsAndIsDir(path: string) {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

async function buildProblemTasks(problem: string): Promise<Array<Task>> {
  const tasks: Array<Task> = []
  const info = await getProblemConfig(problem)

  if (!isStandardProblem(info)) {
    // Build a single image for live-environment problems.
    // Uses the k3s base image and copies setup.sh + check.sh into it.
    const tag = `easyshell-${problem}-1` // sentinel testcaseId=1
    const IMAGE_DIR = `${WORKING_DIR}/images/${tag}`
    await mkdir(IMAGE_DIR, { recursive: true })

    // Copy entrypoint source (needed for k3s-base Dockerfile build)
    await cp(`${PROJECT_ROOT}/apps/entrypoint`, `${IMAGE_DIR}/entrypoint`, {
      recursive: true,
    })

    // Copy k3s-base files
    await cp(
      `${PROJECT_ROOT}/packages/problems/k3s-base`,
      `${IMAGE_DIR}/k3s-base`,
      { recursive: true },
    )

    // Copy problem-specific files (setup.sh, check.sh)
    const problemDir = `${PROBLEMS_DIR}/${problem}`
    await cp(`${problemDir}/setup.sh`, `${IMAGE_DIR}/setup.sh`)
    await cp(`${problemDir}/check.sh`, `${IMAGE_DIR}/check.sh`)

    // Generate Dockerfile
    await writeFile(
      `${IMAGE_DIR}/Dockerfile`,
      `
FROM golang:1.23-alpine AS build-entrypoint
WORKDIR /src
COPY entrypoint/ /src/
RUN go build -o /bin/entrypoint

FROM alpine:3.21 AS tools
RUN apk add --no-cache bash

FROM rancher/k3s:v1.32.3-k3s1

COPY --from=tools /bin/bash /bin/bash
COPY --from=tools /lib/ld-musl-x86_64.so.1 /lib/ld-musl-x86_64.so.1
COPY --from=tools /usr/lib/libreadline.so* /usr/lib/
COPY --from=tools /usr/lib/libncursesw.so* /usr/lib/

COPY --from=build-entrypoint /bin/entrypoint /entrypoint
COPY k3s-base/cgroupv2-fix.sh /usr/local/bin/cgroupv2-fix.sh
COPY k3s-base/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/cgroupv2-fix.sh /usr/local/bin/docker-entrypoint.sh

COPY setup.sh /setup.sh
COPY check.sh /check.sh
RUN chmod +x /setup.sh /check.sh

RUN mkdir -p /tmp/easyshell /home
WORKDIR /home

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["-mode", "k3s-session"]
`,
    )

    tasks.push({
      name: `build-${tag}`,
      callable: async () => {
        await dockerBuild({ tag, dir: IMAGE_DIR })
        return "done"
      },
    })

    return tasks
  }

  for (const testcase of info.testcases) {
    const tag = `easyshell-${problem}-${testcase.id}`

    const IMAGE_DIR = `${WORKING_DIR}/images/${tag}`
    await mkdir(IMAGE_DIR, {
      recursive: true,
    })

    const TESTCASE_DIR = `${PROBLEMS_DIR}/${problem}/testcases/${testcase.id}`
    await mkdir(TESTCASE_DIR, {
      recursive: true,
    })

    let copyRoot = false

    if (await _existsAndIsDir(TESTCASE_DIR)) {
      if (
        (await _existsAndIsDir(`${TESTCASE_DIR}/home`)) ||
        (await _existsAndIsDir(`${TESTCASE_DIR}/root`))
      ) {
        if (await _existsAndIsDir(`${TESTCASE_DIR}/home`)) {
          await cp(`${TESTCASE_DIR}/home`, `${IMAGE_DIR}/home`, {
            recursive: true,
          })
        }

        if (await _existsAndIsDir(`${TESTCASE_DIR}/root`)) {
          copyRoot = true
          await cp(`${TESTCASE_DIR}/root`, `${IMAGE_DIR}/root`, {
            recursive: true,
          })
        }
      } else {
        await cp(TESTCASE_DIR, `${IMAGE_DIR}/home`, { recursive: true })
      }
    }
    if (!(await _existsAndIsDir(`${IMAGE_DIR}/home`))) {
      await mkdir(`${IMAGE_DIR}/home`, {
        recursive: true,
      })
    }

    let daemon_build_steps: string | undefined

    if (testcase.daemonSetup !== undefined) {
      daemon_build_steps = await testcase.daemonSetup({
        image_dir: IMAGE_DIR,
        testcase_dir: TESTCASE_DIR,
        problem_dir: `${PROBLEMS_DIR}/${problem}`,
      })
    }

    await writeFile(
      `${WORKING_DIR}/images/${tag}/Dockerfile`,
      `
${
  daemon_build_steps
    ? `
FROM alpine:3.21 AS build
${daemon_build_steps}
`
    : ""
}

FROM easyshell-base
COPY home /home
${copyRoot ? "COPY root/* ." : ""}
${daemon_build_steps ? "COPY --from=build /daemon /daemon" : ""}

ENTRYPOINT ["/entrypoint"]
`,
    )

    tasks.push({
      name: `build-${tag}`,
      callable: async () => {
        await dockerBuild({
          tag: tag,
          dir: IMAGE_DIR,
        })
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
      "Provide a problem slug to build. Provide 'all' to build all problems.",
    )
    process.exit(1)
  }
  if (args.length > 1) {
    console.error("Too many arguments")
    process.exit(1)
  }
  const arg = args[0]!

  const build_tasks: Array<Task> = []

  const problems = await getProblems()
  if (arg === "all") {
    await init()
    for (const problem of problems)
      build_tasks.push(...(await buildProblemTasks(problem)))
  } else {
    if (!problems.includes(arg)) {
      console.error(`Problem not found: ${arg}`)
      process.exit(1)
    }
    await init()
    build_tasks.push(...(await buildProblemTasks(arg)))
  }

  console.log()
  console.log(
    "=================================== Building ===================================",
  )
  console.log()
  await RunParallelStuff({
    tasks: build_tasks,
    parallel_limit: env.PARALLEL_LIMIT,
  })
  console.log(
    "================================================================================",
  )
  console.log()
  console.log("All Done!")
}

await main()
