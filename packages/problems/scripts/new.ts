import { mkdir, writeFile } from "fs/promises"

import { getProblemInfo, getProblems } from "@easyshell/problems"
import { PROBLEMS_DIR } from "@easyshell/utils/build"

import { max } from "@/lib/utils"

const STANDARD_CONFIG_TEMPLATE = `
import type { StandardProblemConfigInput } from "@easyshell/problems/schema"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<StandardProblemConfigInput["testcases"][number]> {
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

const config: StandardProblemConfigInput = {
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

const LIVE_ENV_CONFIG_TEMPLATE = `
import type { LiveEnvironmentProblemConfigInput } from "@easyshell/problems/schema"

const config: LiveEnvironmentProblemConfigInput = {
  type: "live-environment",
  id: __ID__,
  slug: "__SLUG__",
  title: "__TITLE__",
  description: \`description\`,
  difficulty: "easy",
  tags: ["CKAD"],
  check: {
    totalPoints: 2,
  },
}

export default config
`

const LIVE_ENV_SETUP_TEMPLATE = `#!/bin/bash
set -euo pipefail

# Setup script for live-environment problem.
# This runs automatically when the k3s cluster is ready.

echo "Setting up environment..."

# TODO: Create namespaces, deployments, services, etc.
`

const LIVE_ENV_CHECK_TEMPLATE = `#!/bin/bash

# Check script for live-environment problem.
# Output format: one line per check with PASS/FAIL prefix.
# Last line must be: Score: X/Y

SCORE=0
TOTAL=0

# --- Check 1 ---
TOTAL=$((TOTAL + 1))
# TODO: Add validation logic
if true; then
  echo "PASS - Check 1 description"
  SCORE=$((SCORE + 1))
else
  echo "FAIL - Check 1 description"
fi

# --- Check 2 ---
TOTAL=$((TOTAL + 1))
# TODO: Add validation logic
if true; then
  echo "PASS - Check 2 description"
  SCORE=$((SCORE + 1))
else
  echo "FAIL - Check 2 description"
fi

echo ""
echo "Score: $SCORE/$TOTAL"
`

const PAGE_TEMPLATE = `
# Problem Statement

Problem statement here.

# Instructions

1. Instructions here
`

async function main() {
  const args = process.argv.slice(2)

  // Parse --type flag
  let type: "standard" | "live-environment" = "standard"
  const positionalArgs: string[] = []

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--type") {
      const typeArg = args[i + 1]
      if (typeArg === "standard" || typeArg === "live-environment") {
        type = typeArg
        i++ // skip next arg
      } else {
        console.error(
          `Invalid type: ${typeArg}. Must be 'standard' or 'live-environment'.`,
        )
        process.exit(1)
      }
    } else {
      positionalArgs.push(args[i]!)
    }
  }

  if (positionalArgs.length < 1) {
    console.error("Usage: new <slug> [--type standard|live-environment]")
    process.exit(1)
  }
  if (positionalArgs.length > 1) {
    console.error("Too many arguments")
    process.exit(1)
  }

  const slug = positionalArgs[0]!

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

  const PROBLEM_DIR = `${PROBLEMS_DIR}/${slug}`
  await mkdir(PROBLEM_DIR, { recursive: true })

  if (type === "live-environment") {
    let config = LIVE_ENV_CONFIG_TEMPLATE
    config = config.replace("__ID__", id.toString())
    config = config.replace("__SLUG__", slug)
    config = config.replace("__TITLE__", title)

    await writeFile(`${PROBLEM_DIR}/config.ts`, config)
    await writeFile(`${PROBLEM_DIR}/page.md`, PAGE_TEMPLATE)
    await writeFile(`${PROBLEM_DIR}/setup.sh`, LIVE_ENV_SETUP_TEMPLATE)
    await writeFile(`${PROBLEM_DIR}/check.sh`, LIVE_ENV_CHECK_TEMPLATE)
    await mkdir(`${PROBLEM_DIR}/hints`, { recursive: true })
    await writeFile(`${PROBLEM_DIR}/hints/1.md`, "Hint 1 content here.\n")

    console.log(`Created live-environment problem: ${slug}`)
  } else {
    let config = STANDARD_CONFIG_TEMPLATE
    config = config.replace("__ID__", id.toString())
    config = config.replace("__SLUG__", slug)
    config = config.replace("__TITLE__", title)

    await writeFile(`${PROBLEM_DIR}/config.ts`, config)
    await writeFile(`${PROBLEM_DIR}/page.md`, PAGE_TEMPLATE)

    console.log(`Created standard problem: ${slug}`)
  }
}

await main()
