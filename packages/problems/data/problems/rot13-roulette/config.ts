import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "rot13-roulette"

function rot13(text: string) {
  return text.replace(/[A-Za-z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base)
  })
}

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const invitation = await readFile(
    `${testcaseDir(SLUG, id)}/invitation.txt`,
    "utf-8",
  )

  return {
    id: id,
    public: isPublic,
    expected_stdout: rot13(invitation),
  }
}

const config: ProblemConfig = {
  id: 84,
  slug: SLUG,
  title: "ROT13 Roulette",
  description: `Your nerdy friend encrypted the party address with ROT13. Twice would've been funnier. 🎲`,
  difficulty: "easy",
  tags: ["tr"],
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
      input: `tr 'A-Za-z' 'N-ZA-Mn-za-m' < invitation.txt`,
    },
    {
      testcase: "all",
      pass: true,
      input: `cat invitation.txt | tr 'a-zA-Z' 'n-za-mN-ZA-M'`,
    },
    {
      testcase: "all",
      pass: true,
      input: `sed 'y/ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz/NOPQRSTUVWXYZABCDEFGHIJKLMnopqrstuvwxyzabcdefghijklm/' invitation.txt`,
    },
    {
      testcase: "all",
      pass: false,
      input: `tr 'a-z' 'n-za-m' < invitation.txt`,
    },
    {
      testcase: 3,
      pass: false,
      input: `tr 'A-Za-z0-9' 'N-ZA-Mn-za-m5-90-4' < invitation.txt`,
    },
  ],
}

export default config
