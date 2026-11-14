import { execa } from "execa"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "coffee-or-takeout"
const TAKEOUT = "Ordering takeout 🍜\n"

async function run(script: string, cwd: string) {
  return await execa("sh", [script], {
    cwd,
    reject: false,
    stripFinalNewline: false,
  })
}

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const dir = testcaseDir(SLUG, id)

  const boil = await run("boil-water.sh", dir)
  let stdout = boil.stdout
  let success = boil.exitCode === 0
  if (success) {
    const brew = await run("brew-coffee.sh", dir)
    stdout += brew.stdout
    success = brew.exitCode === 0
  }
  if (!success) stdout += TAKEOUT

  return {
    id: id,
    public: isPublic,
    expected_stdout: stdout,
  }
}

const config: ProblemConfig = {
  id: 30,
  slug: SLUG,
  title: "Coffee or Takeout",
  description: `Brew coffee only if the water boils. Otherwise, give up and order takeout. ☕`,
  difficulty: "easy",
  tags: ["&&", "||"],
  testcases: [
    await testcaseConfig({ id: 1, isPublic: true }),
    await testcaseConfig({ id: 2, isPublic: true }),
    await testcaseConfig({ id: 3, isPublic: false }),
    await testcaseConfig({ id: 4, isPublic: false }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `./boil-water.sh && ./brew-coffee.sh || echo 'Ordering takeout 🍜'`,
    },
    {
      testcase: "all",
      pass: true,
      input: `if ./boil-water.sh && ./brew-coffee.sh; then :; else echo 'Ordering takeout 🍜'; fi`,
    },
    {
      testcase: "all",
      pass: true,
      input: `{ ./boil-water.sh && ./brew-coffee.sh; } || printf 'Ordering takeout 🍜\\n'`,
    },
    {
      testcase: 2,
      pass: false,
      input: `./boil-water.sh; ./brew-coffee.sh || echo 'Ordering takeout 🍜'`,
    },
    {
      testcase: [1, 4],
      pass: false,
      input: `./boil-water.sh && ./brew-coffee.sh; echo 'Ordering takeout 🍜'`,
    },
    {
      testcase: [2, 3],
      pass: false,
      input: `./boil-water.sh || echo 'Ordering takeout 🍜' && ./brew-coffee.sh`,
    },
  ],
}

export default config
