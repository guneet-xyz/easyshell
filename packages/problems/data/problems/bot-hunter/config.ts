import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "bot-hunter"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const log = await readFile(`${testcaseDir(SLUG, id)}/access.log`, "utf-8")
  const perMinute = new Map<string, number>()
  const bots = new Set<string>()
  for (const line of log.split("\n").filter(Boolean)) {
    const fields = line.split(" ")
    const ip = fields[0]!
    // [14/Nov/2026:03:12:45 -> 14/Nov/2026:03:12
    const key = `${ip} ${fields[3]!.slice(1, 18)}`
    const count = (perMinute.get(key) ?? 0) + 1
    perMinute.set(key, count)
    if (count > 20) bots.add(ip)
  }

  return {
    id: id,
    public: isPublic,
    expected_stdout: [...bots].toSorted().join("\n"),
  }
}

const config: ProblemConfig = {
  id: 58,
  slug: SLUG,
  title: "Bot Hunter",
  description: `Someone's hammering your API at 3 a.m. Unmask the bots. 🤖`,
  difficulty: "hard",
  tags: ["awk", "sort", "uniq"],
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
      input: `awk '{print $1, substr($4, 2, 17)}' access.log | sort | uniq -c | awk '$1 > 20 {print $2}' | sort -u`,
    },
    {
      testcase: "all",
      pass: true,
      input: `awk '{k = $1 " " substr($4, 2, 17); if (++c[k] == 21) print $1}' access.log | sort | uniq`,
    },
    {
      testcase: "all",
      pass: true,
      input: `sed 's/:[0-9][0-9] +0000.*//' access.log | cut -d' ' -f1,4 | sort | uniq -c | awk '$1 >= 21 {print $2}' | sort -u`,
    },
    {
      // Counts requests over the whole log, not per minute.
      testcase: "all",
      pass: false,
      input: `awk '{print $1}' access.log | sort | uniq -c | awk '$1 > 20 {print $2}'`,
    },
    {
      // Exactly 20 requests in a minute is still human.
      testcase: [3],
      pass: false,
      input: `awk '{print $1, substr($4, 2, 17)}' access.log | sort | uniq -c | awk '$1 >= 20 {print $2}' | sort -u`,
    },
    {
      // Merges the same minute of different days.
      testcase: [5],
      pass: false,
      input: `awk '{print $1, substr($4, 14, 5)}' access.log | sort | uniq -c | awk '$1 > 20 {print $2}' | sort -u`,
    },
  ],
}

export default config
