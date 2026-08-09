import { getProblemIds } from "@easyshell/data/problems"
import { PROBLEMS_DIR } from "@easyshell/utils/build"

import { mkdir, writeFile } from "fs/promises"

const CONFIG_TEMPLATE = `
import type { ProblemConfig } from "@easyshell/data/problems"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  return {
    id: id,
    public: isPublic,
    daemonSetup: async ({ image_dir, problem_dir, testcase_dir }) => {
      // setup the daemon, perform copies and string replacements.
      return \`
# dockerfile instructions to build the /daemon executable
\`
    },
  }
}

const config: ProblemConfig = {
  id: "__ID__",
  title: "__TITLE__",
  description: \`description\`,
  difficulty: "easy",
  tags: ["Basics"],
  testcases: [
    await testcaseConfig({
      id: 1,
      isPublic: true,
    }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: \`echo Hello World\`,
    },
  ],
}

export default config
`

const PAGE_TEMPLATE = `
# Problem Statement

Problem statement here.

# Instructions

1. Instructions here
`

async function main() {
  const args = process.argv.slice(2)
  if (args.length < 1) {
    console.error("Provide a problem id")
    process.exit(1)
  }
  if (args.length > 1) {
    console.error("Too many arguments")
    process.exit(1)
  }

  const id = args[0]!

  if (!id.match(/^[a-z0-9-]+$/)) {
    console.error("Invalid id")
    process.exit(1)
  }

  const problems = getProblemIds()
  if (problems.includes(id)) {
    console.error(`Problem ${id} already exists`)
    process.exit(1)
  }

  const title = id

  let config = CONFIG_TEMPLATE
  config = config.replace("__ID__", id)
  config = config.replace("__TITLE__", title)

  const PROBLEM_DIR = `${PROBLEMS_DIR}/${id}`
  await mkdir(PROBLEM_DIR, { recursive: true })

  await writeFile(`${PROBLEM_DIR}/config.ts`, config)
  await writeFile(`${PROBLEM_DIR}/page.md`, PAGE_TEMPLATE)

  console.log(`Created Problem : ${id}`)
}

await main()
