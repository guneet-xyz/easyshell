import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "does-it-spark-joy"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const text = await readFile(`${testcaseDir(SLUG, id)}/notes.md`, "utf-8")
  // Fixtures end with a newline.
  const lines = text
    .split("\n")
    .slice(0, -1)
    .map((line) => line.replace(/[ \t]+$/, ""))
    .filter((line, i, all) => !(line === "" && i > 0 && all[i - 1] === ""))
  return {
    id: id,
    public: isPublic,
    expected_fs: {
      "notes.md": lines.map((line) => `${line}\n`).join(""),
    },
  }
}

const config: ProblemConfig = {
  id: 46,
  slug: SLUG,
  title: "Does It Spark Joy?",
  description: `Trailing whitespace does not spark joy. Thank it, and let it go. ✨`,
  difficulty: "medium",
  tags: ["sed", "awk"],
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
      input: `awk '{ sub(/[ \\t]+$/, "") } !(/^$/ && p) { print } { p = /^$/ }' notes.md > t && mv t notes.md`,
    },
    {
      testcase: "all",
      pass: true,
      input: `sed -i 's/[[:blank:]]*$//' notes.md
sed -i '/^$/N;/^\\n$/D' notes.md`,
    },
    {
      testcase: [2, 3, 4],
      pass: false,
      input: `sed -i 's/[[:blank:]]*$//' notes.md`,
    },
    {
      testcase: [1, 3, 4],
      pass: false,
      input: `awk '!(/^$/ && p) { print } { p = /^$/ }' notes.md > t && mv t notes.md`,
    },
    {
      testcase: [3, 4],
      pass: false,
      input: `awk '!(/^$/ && p) { print } { p = /^$/ }' notes.md | sed 's/[[:blank:]]*$//' > t && mv t notes.md`,
    },
    {
      testcase: 4,
      pass: false,
      input: `sed -i 's/[[:blank:]]*$//' notes.md
sed -i '/^$/N;/^\\n$/D' notes.md
sed -i '/./,$!d' notes.md`,
    },
  ],
}

export default config
