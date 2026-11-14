import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "join-the-party"

async function readCsvRows(path: string) {
  return (await readFile(path, "utf-8"))
    .split("\n")
    .slice(1)
    .filter((line) => line.length > 0)
    .map((line) => line.split(","))
}

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const dir = testcaseDir(SLUG, id)

  const names = new Map<string, string>()
  for (const [customerId, name] of await readCsvRows(`${dir}/customers.csv`))
    names.set(customerId!, name!)

  // Totals in cents, so that no floating point rounding gets in the way.
  const totals = new Map<string, number>()
  for (const [, customerId, amount] of await readCsvRows(`${dir}/orders.csv`))
    totals.set(
      names.get(customerId!)!,
      (totals.get(names.get(customerId!)!) ?? 0) +
        Math.round(Number(amount) * 100),
    )

  const lines = Array.from(totals.entries())
    .toSorted(([nameA, a], [nameB, b]) =>
      a !== b ? b - a : nameA < nameB ? -1 : 1,
    )
    .map(
      ([name, cents]) =>
        `${name},${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`,
    )

  return {
    id: id,
    public: isPublic,
    expected_stdout: lines.join("\n"),
  }
}

const config: ProblemConfig = {
  id: 71,
  slug: SLUG,
  title: "Join the Party",
  description: `Orders in one file, customers in another, and your boss wants names. Join the party. 🤝`,
  difficulty: "hard",
  tags: ["awk", "sort"],
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
      input: `awk -F, 'FNR == 1 {next} NR == FNR {n[$1] = $2; next} {t[$2] += $3} END {for (c in t) printf "%s,%.2f\\n", n[c], t[c]}' customers.csv orders.csv | sort -t, -k2,2nr -k1,1`,
    },
    {
      testcase: "all",
      pass: true,
      input: `tail -n +2 customers.csv | while IFS=, read -r id name; do
  awk -F, -v id="$id" -v name="$name" 'NR > 1 && $2 == id {total += $3; found = 1} END {if (found) printf "%s,%.2f\\n", name, total}' orders.csv
done | sort -t, -k2,2nr -k1,1`,
    },
    {
      testcase: "all",
      pass: false,
      input: `awk -F, 'NR == FNR {n[$1] = $2; next} {t[$2] += $3} END {for (c in t) printf "%s,%.2f\\n", n[c], t[c]}' customers.csv orders.csv | sort -t, -k2,2nr -k1,1`,
    },
    {
      testcase: "all",
      pass: false,
      input: `awk -F, 'FNR == 1 {next} NR == FNR {n[$1] = $2; next} {t[$2] += $3} END {for (c in t) print n[c] "," t[c]}' customers.csv orders.csv | sort -t, -k2,2nr -k1,1`,
    },
    {
      testcase: [3, 4],
      pass: false,
      input: `awk -F, 'FNR == 1 {next} NR == FNR {n[$1] = $2; next} {t[$2] += $3} END {for (c in n) printf "%s,%.2f\\n", n[c], t[c]}' customers.csv orders.csv | sort -t, -k2,2nr -k1,1`,
    },
  ],
}

export default config
