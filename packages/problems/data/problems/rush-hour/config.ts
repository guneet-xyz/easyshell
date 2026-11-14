import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "rush-hour"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const log = await readFile(`${testcaseDir(SLUG, id)}/access.log`, "utf-8")
  const counts = new Map<string, number>()
  for (const line of log.split("\n").filter(Boolean)) {
    // The timestamp field looks like [14/Nov/2026:03:12:45
    const hour = line.split(" ")[3]!.slice(13, 15)
    counts.set(hour, (counts.get(hour) ?? 0) + 1)
  }
  const [hour, count] = [...counts.entries()].toSorted(
    (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1),
  )[0]!

  return {
    id: id,
    public: isPublic,
    expected_stdout: `${hour} ${count}`,
  }
}

const config: ProblemConfig = {
  id: 53,
  slug: SLUG,
  title: "Rush Hour",
  description: `When does everyone doomscroll? Find the busiest hour. ⏰`,
  difficulty: "medium",
  tags: ["cut", "sort", "uniq"],
  testcases: [
    await testcaseConfig({ id: 1, isPublic: true }),
    await testcaseConfig({ id: 2, isPublic: true }),
    await testcaseConfig({ id: 3, isPublic: false }),
    await testcaseConfig({ id: 4, isPublic: false }),
    await testcaseConfig({ id: 5, isPublic: false }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `awk '{print substr($4, 14, 2)}' access.log | sort | uniq -c | sort -k1,1nr -k2,2n | head -n 1 | awk '{print $2, $1}'`,
    },
    {
      testcase: "all",
      pass: true,
      input: `cut -d'[' -f2 access.log | cut -d: -f2 | sort | uniq -c | sort -k1,1nr -k2,2 | head -n 1 | awk '{print $2, $1}'`,
    },
    {
      testcase: "all",
      pass: true,
      input: `awk '{h = substr($4, 14, 2); c[h]++} END {for (h in c) if (c[h] > max || (c[h] == max && h < best)) {max = c[h]; best = h}; print best, max}' access.log`,
    },
    {
      // Groups by day and hour instead of by hour.
      testcase: [3],
      pass: false,
      input: `awk '{print substr($4, 2, 14)}' access.log | sort | uniq -c | sort -k1,1nr -k2,2 | head -n 1 | awk '{print substr($2, 13, 2), $1}'`,
    },
    {
      // On a tie, the latest hour wins.
      testcase: [4],
      pass: false,
      input: `awk '{print substr($4, 14, 2)}' access.log | sort | uniq -c | sort -nr | head -n 1 | awk '{print $2, $1}'`,
    },
    {
      // IPv6 addresses contain colons too.
      testcase: [5],
      pass: false,
      input: `cut -d: -f2 access.log | sort | uniq -c | sort -k1,1nr -k2,2n | head -n 1 | awk '{print $2, $1}'`,
    },
  ],
}

export default config
