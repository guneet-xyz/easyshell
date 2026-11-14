import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "five-hundred-reasons"

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
    const fields = line.split(" ")
    const status = Number(fields[8])
    if (status < 500 || status > 599) continue
    const path = fields[6]!.split("?")[0]!
    counts.set(path, (counts.get(path) ?? 0) + 1)
  }
  const [first, second] = [...counts.entries()].toSorted((a, b) => b[1] - a[1])
  if (!first || first[1] === second?.[1])
    throw new Error(`${SLUG}/${id}: there must be a single winner`)

  return {
    id: id,
    public: isPublic,
    expected_stdout: first[0],
  }
}

const config: ProblemConfig = {
  id: 54,
  slug: SLUG,
  title: "Five Hundred Reasons",
  description: `Something keeps throwing 500s. Find the guilty endpoint. 🔥`,
  difficulty: "medium",
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
      input: `awk '$9 ~ /^5/ {split($7, p, "?"); print p[1]}' access.log | sort | uniq -c | sort -nr | head -n 1 | awk '{print $2}'`,
    },
    {
      testcase: "all",
      pass: true,
      input: `awk '$9 >= 500 && $9 < 600 {print $7}' access.log | cut -d'?' -f1 | sort | uniq -c | sort -rn | head -n 1 | awk '{print $2}'`,
    },
    {
      testcase: "all",
      pass: true,
      input: `grep -E '" 5[0-9]{2} ' access.log | awk '{sub(/[?].*/, "", $7); c[$7]++} END {for (p in c) if (c[p] > max) {max = c[p]; top = p}; print top}'`,
    },
    {
      // Doesn't strip the query strings.
      testcase: [3],
      pass: false,
      input: `awk '$9 ~ /^5/ {print $7}' access.log | sort | uniq -c | sort -nr | head -n 1 | awk '{print $2}'`,
    },
    {
      // Counts 4xx errors too.
      testcase: [4],
      pass: false,
      input: `awk '$9 >= 400 {split($7, p, "?"); print p[1]}' access.log | sort | uniq -c | sort -nr | head -n 1 | awk '{print $2}'`,
    },
    {
      // Only counts 500, not 502, 503 or 504.
      testcase: [5],
      pass: false,
      input: `awk '$9 == 500 {split($7, p, "?"); print p[1]}' access.log | sort | uniq -c | sort -nr | head -n 1 | awk '{print $2}'`,
    },
  ],
}

export default config
