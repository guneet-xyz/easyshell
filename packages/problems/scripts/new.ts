import { mkdir, writeFile } from "fs/promises"

import { getProblemInfo, getProblems } from "@easyshell/problems"
import { PROBLEMS_DIR } from "@easyshell/utils/build"

import { max } from "@/lib/utils"

const CONFIG_TEMPLATE = `
import type { ProblemConfig } from "@easyshell/problems/schema"

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
  id: __ID__,
  slug: "__SLUG__",
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
    console.error("Provide a problem slug")
    process.exit(1)
  }
  if (args.length > 1) {
    console.error("Too many arguments")
    process.exit(1)
  }

  const slug = args[0]!

  if (!slug.match(/^[a-z0-9-]+$/)) {
    console.error("Invalid slug")
    process.exit(1)
  }

  const problems = await getProblems()
  if (problems.includes(slug)) {
    console.error(`Problem ${slug} already exists`)
    process.exit(1)
  }

  const id =
    max(
      ...(await Promise.all(
        problems.map(async (p) => (await getProblemInfo(p)).id),
      )),
    ) + 1

  const title = slug

  let config = CONFIG_TEMPLATE
  config = config.replace("__ID__", id.toString())
  config = config.replace("__SLUG__", slug)
  config = config.replace("__TITLE__", title)

  const PROBLEM_DIR = `${PROBLEMS_DIR}/${slug}`
  await mkdir(PROBLEM_DIR, { recursive: true })

  await writeFile(`${PROBLEM_DIR}/config.ts`, config)
  await writeFile(`${PROBLEM_DIR}/page.md`, PAGE_TEMPLATE)

  console.log(`Created Problem : ${slug}`)
}

await main()
