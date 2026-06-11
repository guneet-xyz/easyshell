import type { ProblemConfig } from "@easyshell/problems/schema"
import { PROBLEMS_DIR } from "@easyshell/utils/build"

import { readdir } from "fs/promises"

const SLUG = "find-that-file"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}) {
  const dir = await readdir(`${PROBLEMS_DIR}/${SLUG}/testcases/${id}`, {
    recursive: true,
  })
  const paths = new Array<string>()
  for (const file of dir) {
    if (file.endsWith("target.txt")) {
      paths.push(file)
    }
  }

  paths.sort()

  return {
    id: id,
    public: isPublic,
    expected_stdout: paths.join("\n") + "\n",
  }
}

const config: ProblemConfig = {
  id: 3,
  slug: SLUG,
  title: "Find That File",
  description: `Hunt down a specific file and reveal its full path—no more guessing where it’s hiding! 🔍`,
  difficulty: "easy",
  tags: ["find"],
  testcases: [
    await testcaseConfig({ id: 1, isPublic: true }),
    await testcaseConfig({ id: 2, isPublic: true }),
    await testcaseConfig({ id: 3, isPublic: true }),
    await testcaseConfig({ id: 4, isPublic: false }),
    await testcaseConfig({ id: 5, isPublic: false }),
  ],
  tests: [
    { testcase: "all", pass: false, input: "find -name target.txt" },
    { testcase: "all", pass: true, input: "find * -name target.txt" },
  ],
}

export default config
