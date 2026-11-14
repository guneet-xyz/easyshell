import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "crime-scene"

/** What `grep -B 2 FATAL` prints, separators included. */
function fatalWithContext(log: string) {
  const lines = log.split("\n").filter(Boolean)
  const output: Array<string> = []
  let lastPrinted = -1
  lines.forEach((line, i) => {
    if (!line.includes("FATAL")) return
    const start = Math.max(0, i - 2, lastPrinted + 1)
    if (lastPrinted >= 0 && start > lastPrinted + 1) output.push("--")
    output.push(...lines.slice(start, i + 1))
    lastPrinted = i
  })
  return output.join("\n")
}

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const log = await readFile(`${testcaseDir(SLUG, id)}/app.log`, "utf-8")

  return {
    id: id,
    public: isPublic,
    expected_stdout: fatalWithContext(log),
  }
}

const config: ProblemConfig = {
  id: 56,
  slug: SLUG,
  title: "Crime Scene",
  description: `Every FATAL error has a backstory. Show the two lines before it. 🔍`,
  difficulty: "easy",
  tags: ["grep"],
  testcases: [
    await testcaseConfig({ id: 1, isPublic: true }),
    await testcaseConfig({ id: 2, isPublic: true }),
    await testcaseConfig({ id: 3, isPublic: false }),
    await testcaseConfig({ id: 4, isPublic: false }),
    await testcaseConfig({ id: 5, isPublic: false }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `grep -B 2 FATAL app.log`,
    },
    {
      testcase: "all",
      pass: true,
      input: `cat app.log | grep --before-context=2 -e FATAL`,
    },
    {
      testcase: "all",
      pass: true,
      input: `grep -F -B2 'FATAL' app.log`,
    },
    {
      testcase: "all",
      pass: false,
      input: `grep FATAL app.log`,
    },
    {
      testcase: "all",
      pass: false,
      input: `grep -A 2 FATAL app.log`,
    },
    {
      // Lowercase "fatal" doesn't count.
      testcase: [5],
      pass: false,
      input: `grep -i -B 2 fatal app.log`,
    },
  ],
}

export default config
