import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "comma-chaos"

/** Splits a CSV line whose quoted fields contain no quotes or newlines. */
function splitCsvLine(line: string) {
  const fields: Array<string> = []
  let field = ""
  let quoted = false
  for (const char of line) {
    if (char === `"`) quoted = !quoted
    else if (char === "," && !quoted) {
      fields.push(field)
      field = ""
    } else field += char
  }
  fields.push(field)
  return fields
}

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const count = (await readFile(`${testcaseDir(SLUG, id)}/venues.csv`, "utf-8"))
    .split("\n")
    .slice(1)
    .filter((line) => line.length > 0)
    .filter((line) => splitCsvLine(line)[1] === "Portland, OR").length

  return {
    id: id,
    public: isPublic,
    expected_stdout: count.toString(),
  }
}

const config: ProblemConfig = {
  id: 73,
  slug: SLUG,
  title: "Comma Chaos",
  description: `Somebody put commas inside the CSV fields. Chaos ensues. 🌀`,
  difficulty: "hard",
  tags: ["awk", "sed", "grep"],
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
      input: `awk -F'"' -v OFS='"' '{for (i = 2; i <= NF; i += 2) gsub(/,/, ";", $i)} 1' venues.csv | cut -d, -f2 | grep -cx '"Portland; OR"'`,
    },
    {
      testcase: "all",
      pass: true,
      input: `awk '{
  field = 1; quoted = 0; city = ""
  for (i = 1; i <= length($0); i++) {
    c = substr($0, i, 1)
    if (c == "\\"") quoted = !quoted
    else if (c == "," && !quoted) field++
    else if (field == 2) city = city c
  }
  if (city == "Portland, OR") count++
} END { print count + 0 }' venues.csv`,
    },
    {
      testcase: "all",
      pass: true,
      input: `sed -E 's/^("[^"]*"|[^",]*),//' venues.csv | grep -c '^"Portland, OR",'`,
    },
    {
      testcase: "all",
      pass: false,
      input: `grep -c 'Portland, OR' venues.csv`,
    },
    {
      testcase: "all",
      pass: false,
      input: `grep -c '^[^,]*,"Portland, OR"' venues.csv`,
    },
  ],
}

export default config
