import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "redact-the-ex"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const text = await readFile(`${testcaseDir(SLUG, id)}/speech.txt`, "utf-8")
  return {
    id: id,
    public: isPublic,
    expected_fs: {
      "speech.txt": text.replaceAll("Kevin", "[REDACTED]"),
    },
  }
}

const config: ProblemConfig = {
  id: 44,
  slug: SLUG,
  title: "Redact the Ex",
  description: `Your best-man speech mentions the groom's ex 14 times. The wedding starts in an hour. 💍`,
  difficulty: "easy",
  tags: ["sed"],
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
      input: `sed -i 's/Kevin/[REDACTED]/g' speech.txt`,
    },
    {
      testcase: "all",
      pass: true,
      input: `sed 's/Kevin/[REDACTED]/g' speech.txt > tmp && mv tmp speech.txt`,
    },
    {
      testcase: "all",
      pass: true,
      input: `awk '{ gsub(/Kevin/, "[REDACTED]"); print }' speech.txt > speech.new
mv speech.new speech.txt`,
    },
    {
      testcase: "all",
      pass: false,
      input: `sed -i 's/Kevin/[REDACTED]/' speech.txt`,
    },
    {
      testcase: "all",
      pass: false,
      input: `sed 's/Kevin/[REDACTED]/g' speech.txt`,
    },
    {
      testcase: "all",
      pass: false,
      input: `sed 's/Kevin/[REDACTED]/g' speech.txt > redacted.txt`,
    },
    {
      testcase: 4,
      pass: false,
      input: `sed -i 's/\\bKevin\\b/[REDACTED]/g' speech.txt`,
    },
  ],
}

export default config
