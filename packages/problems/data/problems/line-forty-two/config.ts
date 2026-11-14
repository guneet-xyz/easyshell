import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "line-forty-two"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const text = await readFile(`${testcaseDir(SLUG, id)}/guide.txt`, "utf-8")
  return {
    id: id,
    public: isPublic,
    expected_stdout: `${text.split("\n")[41]}\n`,
  }
}

const config: ProblemConfig = {
  id: 38,
  slug: SLUG,
  title: "Line Forty-Two",
  description: `The answer to life, the universe and everything is on line 42. Obviously. 🌌`,
  difficulty: "easy",
  tags: ["sed", "head", "tail"],
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
      input: `sed -n '42p' guide.txt`,
    },
    {
      testcase: "all",
      pass: true,
      input: `head -n 42 guide.txt | tail -n 1`,
    },
    {
      testcase: "all",
      pass: true,
      input: `awk 'NR == 42' guide.txt`,
    },
    {
      testcase: "all",
      pass: false,
      input: `head -n 42 guide.txt`,
    },
    {
      testcase: "all",
      pass: false,
      input: `tail -n 42 guide.txt | head -n 1`,
    },
    {
      testcase: 4,
      pass: false,
      input: `grep -i 'answer' guide.txt`,
    },
  ],
}

export default config
