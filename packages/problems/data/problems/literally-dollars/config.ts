import { existsSync } from "fs"

import type { FsType, ProblemConfig } from "@easyshell/problems/schema"
import { getFs, testcaseDir } from "@easyshell/utils/build"

const SLUG = "literally-dollars"

// Must match the script shown in page.md, byte for byte.
const LINES = [
  "#!/bin/sh",
  "# pay-day.sh: pays whoever runs it. What could possibly go wrong?",
  'echo "Paying $USER on $(date +%A)..."',
  'echo "Signed off by: `whoami`"',
  "printf 'Amount: $1,000,000\\nStatus: \"definitely pending\"\\n'",
  'echo "Grandma\'s cut: \\$5 (she insisted)"',
]
const PAY_DAY = LINES.map((line) => `${line}\n`).join("")

/** Quotes a string for the shell, so that it is taken literally. */
function singleQuote(text: string) {
  return `'${text.replaceAll("'", `'\\''`)}'`
}

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  // Testcase 1 starts with an empty home, which git can't store as a folder.
  const dir = testcaseDir(SLUG, id)
  const originalFs: FsType = existsSync(dir) ? await getFs(dir) : {}

  return {
    id: id,
    public: isPublic,
    expected_fs: { ...originalFs, "pay-day.sh": PAY_DAY },
  }
}

const config: ProblemConfig = {
  id: 33,
  slug: SLUG,
  title: "Literally Dollars",
  description: `Write a script with the shell, without the shell eating your dollar signs. 💸`,
  difficulty: "medium",
  tags: ["heredoc", "quoting"],
  testcases: [
    await testcaseConfig({ id: 1, isPublic: true }),
    await testcaseConfig({ id: 2, isPublic: true }),
    await testcaseConfig({ id: 3, isPublic: false }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `cat > pay-day.sh <<'EOF'\n${PAY_DAY}EOF`,
    },
    {
      testcase: "all",
      pass: true,
      input: `printf '%s\\n' ${LINES.map(singleQuote).join(" ")} > pay-day.sh`,
    },
    {
      testcase: "all",
      pass: true,
      input: `rm -f pay-day.sh\nwhile IFS= read -r line; do printf '%s\\n' "$line" >> pay-day.sh; done <<\\PAYDAY\n${PAY_DAY}PAYDAY`,
    },
    {
      testcase: "all",
      pass: false,
      input: `cat > pay-day.sh <<EOF\n${PAY_DAY}EOF`,
    },
    {
      testcase: 2,
      pass: false,
      input: `cat >> pay-day.sh <<'EOF'\n${PAY_DAY}EOF`,
    },
  ],
}

export default config
