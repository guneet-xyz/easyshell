import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "word-up"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const text = await readFile(
    `${testcaseDir(SLUG, id)}/shakespeare.txt`,
    "utf-8",
  )
  const counts = new Map<string, number>()
  for (const word of text.toLowerCase().match(/[a-z]+/g) ?? []) {
    counts.set(word, (counts.get(word) ?? 0) + 1)
  }
  const top = Array.from(counts.entries())
    .toSorted(([a, x], [b, y]) => y - x || (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, 5)
  return {
    id: id,
    public: isPublic,
    expected_stdout: top.map(([word, count]) => `${word} ${count}\n`).join(""),
  }
}

const config: ProblemConfig = {
  id: 43,
  slug: SLUG,
  title: "Word Up",
  description: `Which word could Shakespeare just not stop saying? Thou shalt find out. 📜`,
  difficulty: "hard",
  tags: ["tr", "sort", "uniq"],
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
      input: `tr -cs 'A-Za-z' '\\n' < shakespeare.txt | tr 'A-Z' 'a-z' | grep -v '^$' | sort | uniq -c | sort -k1,1nr -k2 | head -n 5 | awk '{ print $2, $1 }'`,
    },
    {
      testcase: "all",
      pass: true,
      input: `awk '{ $0 = tolower($0); gsub(/[^a-z]+/, " "); for (i = 1; i <= NF; i++) c[$i]++ } END { for (w in c) print w, c[w] }' shakespeare.txt | sort -k2,2nr -k1,1 | head -n 5`,
    },
    {
      testcase: "all",
      pass: true,
      input: `grep -oE '[A-Za-z]+' shakespeare.txt | tr '[:upper:]' '[:lower:]' | sort | uniq -c | sort -k1,1nr -k2 | head -n 5 | while read count word; do echo "$word $count"; done`,
    },
    {
      testcase: "all",
      pass: false,
      input: `tr -cs 'A-Za-z' '\\n' < shakespeare.txt | grep -v '^$' | sort | uniq -c | sort -k1,1nr -k2 | head -n 5 | awk '{ print $2, $1 }'`,
    },
    {
      testcase: "all",
      pass: false,
      input: `tr -s ' \\n' '\\n\\n' < shakespeare.txt | tr 'A-Z' 'a-z' | grep -v '^$' | sort | uniq -c | sort -k1,1nr -k2 | head -n 5 | awk '{ print $2, $1 }'`,
    },
    {
      testcase: "all",
      pass: false,
      input: `tr -cs 'A-Za-z' '\\n' < shakespeare.txt | tr 'A-Z' 'a-z' | grep -v '^$' | sort | uniq -c | sort -k1,1nr -k2 | head -n 5`,
    },
  ],
}

export default config
