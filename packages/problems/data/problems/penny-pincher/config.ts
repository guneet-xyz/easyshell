import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "penny-pincher"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const text = await readFile(`${testcaseDir(SLUG, id)}/expenses.csv`, "utf-8")
  // Sum in cents to avoid floating point surprises.
  let cents = 0
  for (const line of text.split("\n").slice(1, -1)) {
    const [, category, amount] = line.split(",")
    if (category === "coffee") cents += Math.round(Number(amount) * 100)
  }
  return {
    id: id,
    public: isPublic,
    expected_stdout: `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}\n`,
  }
}

const config: ProblemConfig = {
  id: 47,
  slug: SLUG,
  title: "Penny Pincher",
  description: `Where did all your money go? Let awk do the crying. 💸`,
  difficulty: "medium",
  tags: ["awk"],
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
      input: `awk -F, '$2 == "coffee" { s += $3 } END { printf "%.2f\\n", s }' expenses.csv`,
    },
    {
      testcase: "all",
      pass: true,
      input: `{ echo 0; grep '^[^,]*,coffee,' expenses.csv | cut -d, -f3; } | paste -sd+ | bc | xargs printf '%.2f\\n'`,
    },
    {
      testcase: "all",
      pass: true,
      input: `total=0
for amount in $(grep ',coffee,' expenses.csv | cut -d, -f3); do
  total=$(echo "$total + $amount" | bc)
done
printf '%.2f\\n' "$total"`,
    },
    {
      testcase: [3, 4],
      pass: false,
      input: `grep coffee expenses.csv | cut -d, -f3 | awk '{ s += $1 } END { printf "%.2f\\n", s }'`,
    },
    {
      testcase: [2, 4],
      pass: false,
      input: `awk -F, '$2 == "coffee" { s += $3 } END { print s }' expenses.csv`,
    },
    {
      testcase: 3,
      pass: false,
      input: `awk -F, '$2 ~ /coffee/ { s += $3 } END { printf "%.2f\\n", s }' expenses.csv`,
    },
  ],
}

export default config
