import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "base64-postcard"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const postcard = await readFile(
    `${testcaseDir(SLUG, id)}/postcard.txt`,
    "utf-8",
  )

  return {
    id: id,
    public: isPublic,
    expected_stdout: Buffer.from(postcard, "base64").toString("utf-8"),
  }
}

const config: ProblemConfig = {
  id: 83,
  slug: SLUG,
  title: "Base64 Postcard",
  description: `Your pen pal only writes in base64. Very romantic. 💌`,
  difficulty: "easy",
  tags: ["base64"],
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
      input: `base64 -d postcard.txt`,
    },
    {
      testcase: "all",
      pass: true,
      input: `cat postcard.txt | base64 -d`,
    },
    {
      testcase: "all",
      pass: true,
      input: `tr -d '\\n' < postcard.txt | base64 -d`,
    },
    {
      testcase: "all",
      pass: false,
      input: `cat postcard.txt`,
    },
    {
      testcase: "all",
      pass: false,
      input: `base64 postcard.txt`,
    },
  ],
}

export default config
