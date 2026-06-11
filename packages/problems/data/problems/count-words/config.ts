import type { ProblemConfig } from "@easyshell/problems/schema"

import { readFile } from "fs/promises"
import { testcaseDir } from "packages/utils/build"

const SLUG = "count-words"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const testcase_dir = testcaseDir(SLUG, id)
  const words = (await readFile(`${testcase_dir}/notes.txt`, "utf-8"))
    .trim()
    .replaceAll("\n", " ")
    .split(" ")
    .filter((w) => w.length > 0).length
  return {
    id: id,
    public: isPublic,
    expected_stdout: words.toString(),
  }
}

const config: ProblemConfig = {
  id: 21,
  slug: SLUG,
  title: "Count Words",
  description: `Count the number of words in a file.`,
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
    await testcaseConfig({
      id: 5,
      isPublic: false,
    }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `wc -w < notes.txt`,
    },
    {
      testcase: "all",
      pass: true,
      input: `cat notes.txt | wc -w`,
    },
    {
      testcase: "all",
      pass: true,
      input: `wc -w notes.txt | awk '{print $1}'`,
    },
  ],
}

export default config
