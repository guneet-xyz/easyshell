import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "buried-treasure"

function countGold(value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce((sum: number, item) => sum + countGold(item), 0)
  }
  if (value !== null && typeof value === "object") {
    let sum = 0
    for (const [key, item] of Object.entries(value)) {
      if (key === "gold" && typeof item === "number") sum += item
      sum += countGold(item)
    }
    return sum
  }
  return 0
}

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const map = JSON.parse(
    await readFile(`${testcaseDir(SLUG, id)}/map.json`, "utf-8"),
  ) as unknown

  return {
    id: id,
    public: isPublic,
    expected_stdout: countGold(map).toString(),
  }
}

const config: ProblemConfig = {
  id: 68,
  slug: SLUG,
  title: "Buried Treasure",
  description: `Somewhere in Captain Shellbeard's horribly nested map lies gold. Lots of it. Probably. 🏴‍☠️`,
  difficulty: "medium",
  tags: ["jq"],
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
      input: `jq '[.. | objects | .gold | numbers] | add // 0' map.json`,
    },
    {
      testcase: "all",
      pass: true,
      input: `jq '[paths(numbers) as $p | select($p[-1] == "gold") | getpath($p)] | add // 0' map.json`,
    },
    {
      testcase: "all",
      pass: true,
      input: `jq -n --stream 'inputs | select(length == 2 and .[0][-1] == "gold") | .[1] | numbers' map.json | awk '{ sum += $1 } END { print sum + 0 }'`,
    },
    {
      testcase: [3, 4],
      pass: false,
      input: `grep -o '"gold": *[0-9]*' map.json | grep -o '[0-9]*$' | awk '{ sum += $1 } END { print sum + 0 }'`,
    },
    {
      testcase: [5],
      pass: false,
      input: `jq '[.. | .gold? | numbers] | add' map.json`,
    },
    {
      testcase: [4, 5],
      pass: false,
      input: `jq '[.. | objects | .gold] | add' map.json`,
    },
  ],
}

export default config
