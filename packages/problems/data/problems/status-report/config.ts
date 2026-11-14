import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "status-report"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const log = await readFile(`${testcaseDir(SLUG, id)}/access.log`, "utf-8")
  const counts = new Map<number, number>()
  for (const line of log.split("\n").filter(Boolean)) {
    const status = Number(line.split(" ")[8])
    counts.set(status, (counts.get(status) ?? 0) + 1)
  }

  return {
    id: id,
    public: isPublic,
    expected_stdout: [...counts.entries()]
      .toSorted(([a], [b]) => a - b)
      .map(([status, count]) => `${status} ${count}`)
      .join("\n"),
  }
}

const config: ProblemConfig = {
  id: 52,
  slug: SLUG,
  title: "Status Report",
  description: `Your boss wants a status report. You take it literally. 📊`,
  difficulty: "easy",
  tags: ["awk", "sort", "uniq"],
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
      input: `awk '{print $9}' access.log | sort | uniq -c | awk '{print $2, $1}'`,
    },
    {
      testcase: "all",
      pass: true,
      input: `awk '{c[$9]++} END {for (s in c) print s, c[s]}' access.log | sort -n`,
    },
    {
      testcase: "all",
      pass: true,
      input: `cut -d'"' -f3 access.log | cut -d' ' -f2 | sort -n | uniq -c | while read count status; do echo "$status $count"; done`,
    },
    {
      testcase: "all",
      pass: false,
      input: `awk '{print $9}' access.log | sort | uniq -c`,
    },
    {
      testcase: "all",
      pass: false,
      input: `grep -o ' [0-9][0-9][0-9] ' access.log | sort | uniq -c`,
    },
    {
      // Counting with grep also counts sizes that look like status codes.
      testcase: [3],
      pass: false,
      input: `awk '{print $9}' access.log | sort -u | while read s; do echo "$s $(grep -c " $s " access.log)"; done`,
    },
  ],
}

export default config
