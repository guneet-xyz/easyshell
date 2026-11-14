import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "strings-attached"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  // The fixtures are binary: see generate-fixtures.ts.
  const binary = (await readFile(`${testcaseDir(SLUG, id)}/app.bin`)).toString(
    "latin1",
  )

  // A printable string that starts with PASSWORD= (not preceded by another
  // printable character), like `strings | grep '^PASSWORD='` finds it.
  const matches = Array.from(
    binary.matchAll(/(?<![\t\x20-\x7e])PASSWORD=([\x20-\x7e]*)/g),
  )
  if (matches.length !== 1) {
    throw new Error(`${SLUG} ${id}: expected exactly one password string`)
  }

  return {
    id: id,
    public: isPublic,
    expected_stdout: matches[0]![1]!,
  }
}

const config: ProblemConfig = {
  id: 86,
  slug: SLUG,
  title: "Strings Attached",
  description: `The admin password is somewhere inside this binary. Probably. 🧵`,
  difficulty: "easy",
  tags: ["strings", "grep"],
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
      input: `strings app.bin | grep '^PASSWORD=' | cut -d= -f2-`,
    },
    {
      testcase: "all",
      pass: true,
      input: `strings app.bin | sed -n 's/^PASSWORD=//p'`,
    },
    {
      testcase: "all",
      pass: true,
      input: `grep -a -o '[[:print:]]*PASSWORD=[[:print:]]*' app.bin | grep '^PASSWORD=' | cut -c10-`,
    },
    {
      testcase: "all",
      pass: false,
      input: `strings app.bin | grep PASSWORD`,
    },
    {
      testcase: [3, 4],
      pass: false,
      input: `grep -a -o 'PASSWORD=[[:print:]]*' app.bin | cut -d= -f2-`,
    },
    {
      testcase: 4,
      pass: false,
      input: `strings app.bin | grep '^PASSWORD=' | cut -d= -f2`,
    },
    {
      testcase: [3, 4],
      pass: false,
      input: `strings app.bin | grep 'PASSWORD=' | tail -n 1 | cut -d= -f2-`,
    },
  ],
}

export default config
