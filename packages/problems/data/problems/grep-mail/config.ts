import type { ProblemConfig } from "@easyshell/problems/schema"
import { PROBLEMS_DIR } from "@easyshell/utils/build"

import { readFile } from "fs/promises"

const SLUG = "grep-mail"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const text = await readFile(
    `${PROBLEMS_DIR}/${SLUG}/testcases/${id}/email.txt`,
  )

  const matches = Array.from(
    text.toString().matchAll(/([^@\s]+@[^@\s]+)/g),
  ).map((match) => match[0]!.toString())

  const emails = new Set<string>()

  for (const match of matches) {
    emails.add(match)
  }

  const stdout = Array.from(emails).toSorted().join("\n")

  return {
    id: id,
    public: isPublic,
    expected_stdout: stdout,
  }
}

const config: ProblemConfig = {
  id: 13,
  slug: SLUG,
  title: "Extract All the E-mails",
  description: `Your boss needs email addresses from a file to "gently encourage" potential investors and clients.`,
  difficulty: "easy",
  tags: ["grep"],
  testcases: [
    await testcaseConfig({
      id: 1,
      isPublic: true,
    }),
    await testcaseConfig({
      id: 2,
      isPublic: true,
    }),
    await testcaseConfig({
      id: 3,
      isPublic: false,
    }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `grep -oP '[^@\\s]+@[^@\\s]+' email.txt | sort | uniq`,
    },
    {
      testcase: "all",
      pass: true,
      input: `grep -oP '[^@\\s]+@[^@\\s]+' email.txt | sort -u`,
    },
    {
      testcase: "all",
      pass: true,
      input: `cat email.txt | grep -oP '[^@\\s]+@[^@\\s]+' | sort -u`,
    },
  ],
}

export default config
