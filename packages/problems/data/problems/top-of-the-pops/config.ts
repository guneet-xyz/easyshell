import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "top-of-the-pops"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const text = await readFile(`${testcaseDir(SLUG, id)}/plays.log`, "utf-8")
  const counts = new Map<string, number>()
  for (const song of text.split("\n").slice(0, -1)) {
    counts.set(song, (counts.get(song) ?? 0) + 1)
  }
  // Fixtures are ASCII, so code unit order is byte order.
  const top = Array.from(counts.entries())
    .toSorted(([a, x], [b, y]) => y - x || (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, 3)
  return {
    id: id,
    public: isPublic,
    expected_stdout: top.map(([song, count]) => `${count} ${song}\n`).join(""),
  }
}

const config: ProblemConfig = {
  id: 42,
  slug: SLUG,
  title: "Top of the Pops",
  description: `Your music app's Year-in-Review is due tomorrow. You have a log file and a dream. 🎧`,
  difficulty: "medium",
  tags: ["sort", "uniq", "head"],
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
      input: `sort plays.log | uniq -c | sort -k1,1nr -k2 | head -n 3 | sed 's/^ *//'`,
    },
    {
      testcase: "all",
      pass: true,
      input: `awk '{ c[$0]++ } END { for (s in c) print c[s], s }' plays.log | sort -k1,1nr -k2 | head -n 3`,
    },
    {
      testcase: "all",
      pass: false,
      input: `sort plays.log | uniq -c | sort -nr | head -n 3`,
    },
    {
      testcase: [2, 3, 4],
      pass: false,
      input: `sort plays.log | uniq -c | sort -nr | head -n 3 | sed 's/^ *//'`,
    },
    {
      testcase: "all",
      pass: false,
      input: `sort plays.log | uniq -c | sort -k1,1nr -k2 | sed 's/^ *//'`,
    },
  ],
}

export default config
