import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "one-of-each"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const text = await readFile(`${testcaseDir(SLUG, id)}/rsvps.txt`, "utf-8")
  // Fixtures are ASCII, so code unit order is byte order.
  const names = Array.from(new Set(text.split("\n").slice(0, -1))).toSorted()
  return {
    id: id,
    public: isPublic,
    expected_stdout: names.map((name) => `${name}\n`).join(""),
  }
}

const config: ProblemConfig = {
  id: 41,
  slug: SLUG,
  title: "One of Each",
  description: `Everyone RSVP'd three times. Grandma RSVP'd nine. The caterer is not amused. 🎉`,
  difficulty: "easy",
  tags: ["sort", "uniq"],
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
      input: `sort -u rsvps.txt`,
    },
    {
      testcase: "all",
      pass: true,
      input: `sort rsvps.txt | uniq`,
    },
    {
      testcase: "all",
      pass: true,
      input: `awk '!seen[$0]++' rsvps.txt | sort`,
    },
    {
      testcase: "all",
      pass: false,
      input: `uniq rsvps.txt`,
    },
    {
      testcase: "all",
      pass: false,
      input: `uniq rsvps.txt | sort`,
    },
    {
      testcase: 4,
      pass: false,
      input: `sort -uf rsvps.txt`,
    },
  ],
}

export default config
