import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "pivot-the-grades"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const rows = (await readFile(`${testcaseDir(SLUG, id)}/scores.csv`, "utf-8"))
    .split("\n")
    .slice(1)
    .filter((line) => line.length > 0)
    .map((line) => line.split(",") as [string, string, string])

  const byCodepoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
  const students = Array.from(new Set(rows.map((row) => row[0]))).toSorted(
    byCodepoint,
  )
  const subjects = Array.from(new Set(rows.map((row) => row[1]))).toSorted(
    byCodepoint,
  )
  const scores = new Map(
    rows.map(([student, subject, score]) => [`${student},${subject}`, score]),
  )

  const lines = [
    ["student", ...subjects].join(","),
    ...students.map((student) =>
      [
        student,
        ...subjects.map(
          (subject) => scores.get(`${student},${subject}`) ?? "-",
        ),
      ].join(","),
    ),
  ]

  return {
    id: id,
    public: isPublic,
    expected_stdout: lines.join("\n"),
  }
}

const AWK_PIVOT = (subjects: string, missing: string) => `
subjects=$(tail -n +2 scores.csv | cut -d, -f2 | ${subjects} | paste -sd, -)
tail -n +2 scores.csv | cut -d, -f1 | sort -u | awk -F, -v subjects="$subjects" '
  NR == FNR { if (FNR > 1) score[$1 FS $2] = $3; next }
  FNR == 1 { n = split(subjects, s, ","); printf "student"; for (i = 1; i <= n; i++) printf ",%s", s[i]; print "" }
  { printf "%s", $0; for (i = 1; i <= n; i++) { k = $0 FS s[i]; printf ",%s", ${missing} }; print "" }
' scores.csv -
`

const config: ProblemConfig = {
  id: 72,
  slug: SLUG,
  title: "Pivot the Grades",
  description: `Grandma wants a table, not a list. Spin it around! 🔄`,
  difficulty: "hard",
  tags: ["awk", "sort", "jq"],
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
      input: AWK_PIVOT("sort -u", `(k in score) ? score[k] : "-"`),
    },
    {
      testcase: "all",
      pass: true,
      input: `tail -n +2 scores.csv | jq -Rrn '[inputs | split(",")] as $rows | ($rows | map(.[1]) | unique) as $subjects | (["student"] + $subjects | join(",")), ($rows | group_by(.[0])[] | .[0][0] as $student | (map({(.[1]): .[2]}) | add) as $scores | [$student] + [$subjects[] | $scores[.] // "-"] | join(","))'`,
    },
    {
      testcase: "all",
      pass: false,
      input: AWK_PIVOT(`awk '!seen[$0]++'`, `(k in score) ? score[k] : "-"`),
    },
    {
      testcase: [3, 4],
      pass: false,
      input: AWK_PIVOT("sort -u", `score[k] ? score[k] : "-"`),
    },
    {
      testcase: [3, 4],
      pass: false,
      input: AWK_PIVOT("sort -u", `score[k]`),
    },
  ],
}

export default config
