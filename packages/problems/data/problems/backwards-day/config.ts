import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "backwards-day"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const text = await readFile(`${testcaseDir(SLUG, id)}/message.txt`, "utf-8")
  // Fixtures are ASCII and end with a newline.
  const lines = text.split("\n").slice(0, -1)
  const decoded = lines
    .toReversed()
    .map((line) => line.split("").toReversed().join(""))
  return {
    id: id,
    public: isPublic,
    expected_stdout: decoded.map((line) => `${line}\n`).join(""),
  }
}

const config: ProblemConfig = {
  id: 40,
  slug: SLUG,
  title: "Backwards Day",
  description: `A spy wrote this message backwards. And upside down. Of course they did. 🕵️`,
  difficulty: "easy",
  tags: ["rev", "tac"],
  testcases: [
    await testcaseConfig({ id: 1, isPublic: true }),
    await testcaseConfig({ id: 2, isPublic: true }),
    await testcaseConfig({ id: 3, isPublic: false }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `tac message.txt | rev`,
    },
    {
      testcase: "all",
      pass: true,
      input: `rev message.txt | tac`,
    },
    {
      testcase: "all",
      pass: true,
      input: `rev < message.txt | sed -n '1!G;h;$p'`,
    },
    {
      testcase: "all",
      pass: false,
      input: `rev message.txt`,
    },
    {
      testcase: "all",
      pass: false,
      input: `tac message.txt`,
    },
  ],
}

export default config
