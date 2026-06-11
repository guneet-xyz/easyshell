import type { ProblemConfig } from "@easyshell/problems/schema"

import { readFile } from "fs/promises"
import { testcaseDir } from "packages/utils/build"

const SLUG = "count-lines"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const testcase_dir = testcaseDir(SLUG, id)
  const lines =
    (await readFile(`${testcase_dir}/notes.txt`, "utf-8")).split("\n").length -
    1
  return {
    id: id,
    public: isPublic,
    expected_stdout: lines.toString(),
  }
}

const config: ProblemConfig = {
  id: 20,
  slug: SLUG,
  title: "Count Lines",
  description: `Count the number of lines in a file`,
  difficulty: "easy",
  tags: ["cat", "wc"],
  testcases: [
    await testcaseConfig({
      id: 1,
      isPublic: true,
    }),
    await testcaseConfig({
      id: 2,
      isPublic: true,
    }),
    await testcaseConfig({
      id: 3,
      isPublic: false,
    }),
    await testcaseConfig({
      id: 4,
      isPublic: false,
    }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `wc -l < notes.txt`,
    },
    {
      testcase: "all",
      pass: true,
      input: `cat notes.txt | wc -l`,
    },
    {
      testcase: "all",
      pass: true,
      input: `wc -l notes.txt | awk '{print \$1}'`,
    },
  ],
}

export default config
