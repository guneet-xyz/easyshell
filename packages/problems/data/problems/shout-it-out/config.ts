import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "shout-it-out"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const text = await readFile(
    `${testcaseDir(SLUG, id)}/announcement.txt`,
    "utf-8",
  )
  return {
    id: id,
    public: isPublic,
    expected_stdout: text.replace(/[a-z]/g, (c) => c.toUpperCase()),
  }
}

const config: ProblemConfig = {
  id: 37,
  slug: SLUG,
  title: "Shout It Out",
  description: `Marketing wants the announcement LOUDER. Much LOUDER. 📢`,
  difficulty: "easy",
  tags: ["tr"],
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
      input: `tr 'a-z' 'A-Z' < announcement.txt`,
    },
    {
      testcase: "all",
      pass: true,
      input: `cat announcement.txt | tr '[:lower:]' '[:upper:]'`,
    },
    {
      testcase: "all",
      pass: true,
      input: `awk '{ print toupper($0) }' announcement.txt`,
    },
    {
      testcase: "all",
      pass: false,
      input: `cat announcement.txt`,
    },
    {
      testcase: "all",
      pass: false,
      input: `tr 'a-z' 'A-Z' announcement.txt`,
    },
  ],
}

export default config
