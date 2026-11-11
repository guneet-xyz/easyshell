import { cp, mkdir, rm, stat, writeFile } from "fs/promises"
import { $ } from "execa"

import { getProblemInfo, getProblems } from "@easyshell/problems"
import { problemImageName } from "@easyshell/problems/image"
import { PROBLEMS_DIR, PROJECT_ROOT } from "@easyshell/utils/build"

import { env } from "../env"
import { RunParallelStuff, Task } from "./_utils"

const WORKING_DIR = `${env.WORKING_DIR}/build`
/** Written by `--contexts-only`: every image to build and its context. */
const IMAGES_JSON_PATH = `${WORKING_DIR}/images.json`

export type ImageContext = {
  problem: string
  testcase: number
  /** Image name without a registry, e.g. `easyshell-problems/say-hello-1`. */
  image: string
  /** Build context directory, containing a self-contained Dockerfile. */
  context: string
}

// Every problem image starts from the same base: alpine with the shell tools
// problems rely on, plus the entrypoint. The base stages are part of each
// image's Dockerfile so that any builder (including a multi-platform buildx
// builder without access to local images) can build an image on its own;
// BuildKit caches the identical stages across images.
const BASE_STAGES = `
FROM alpine:3.21 AS entrypoint-build

RUN apk add --no-cache go

COPY entrypoint /src/entrypoint

RUN go build -C /src/entrypoint -o /bin/entrypoint

FROM alpine:3.21 AS easyshell-base

RUN apk add --no-cache zip jq curl grep

COPY --from=entrypoint-build /bin/entrypoint /entrypoint
`

async function _existsAndIsDir(path: string) {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

async function prepareProblemContexts(
  problem: string,
): Promise<Array<ImageContext>> {
  const contexts: Array<ImageContext> = []
  const info = await getProblemInfo(problem)
  for (const testcase of info.testcases) {
    const image = problemImageName(problem, testcase.id)

    const IMAGE_DIR = `${WORKING_DIR}/images/${problem}-${testcase.id}`
    await mkdir(IMAGE_DIR, {
      recursive: true,
    })

    await cp(`${PROJECT_ROOT}/apps/entrypoint`, `${IMAGE_DIR}/entrypoint`, {
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
      `${IMAGE_DIR}/Dockerfile`,
      `${BASE_STAGES}
${
  daemon_build_steps
    ? `
FROM alpine:3.21 AS daemon-build
${daemon_build_steps}
`
    : ""
}

FROM easyshell-base
COPY home /home
${copyRoot ? "COPY root/* ." : ""}
${daemon_build_steps ? "COPY --from=daemon-build /daemon /daemon" : ""}

ENTRYPOINT ["/entrypoint"]
`,
    )

    contexts.push({
      problem,
      testcase: testcase.id,
      image,
      context: IMAGE_DIR,
    })
  }
  return contexts
}

function buildTask({ image, context }: ImageContext): Task {
  return {
    name: `build-${image}`,
    callable: async () => {
      await $`docker build -t ${image} ${context}`
    },
  }
}

async function main() {
  const args = process.argv.slice(2)
  const contextsOnly = args.includes("--contexts-only")
  const slugs = args.filter((arg) => arg !== "--contexts-only")
  if (slugs.length === 0) {
    console.error(
      "Provide one or more problem slugs to build, or 'all' to build all problems. Pass --contexts-only to only write the build contexts.",
    )
    process.exit(1)
  }

  const problems = await getProblems()
  let selected: Array<string>
  if (slugs.length === 1 && slugs[0] === "all") {
    selected = problems
  } else {
    for (const slug of slugs) {
      if (!problems.includes(slug)) {
        console.error(`Problem not found: ${slug}`)
        process.exit(1)
      }
    }
    selected = [...new Set(slugs)]
  }

  await rm(WORKING_DIR, { recursive: true, force: true })

  const contexts: Array<ImageContext> = []
  for (const problem of selected)
    contexts.push(...(await prepareProblemContexts(problem)))

  if (contextsOnly) {
    await writeFile(IMAGES_JSON_PATH, JSON.stringify(contexts, null, 2))
    console.log(
      `Wrote ${contexts.length} build contexts to ${IMAGES_JSON_PATH}`,
    )
    return
  }

  console.log()
  console.log(
    "=================================== Building ===================================",
  )
  console.log()
  await RunParallelStuff({
    tasks: contexts.map(buildTask),
    parallel_limit: env.PARALLEL_LIMIT,
  })
  console.log(
    "================================================================================",
  )
  console.log()
  console.log("All Done!")
}

await main()
