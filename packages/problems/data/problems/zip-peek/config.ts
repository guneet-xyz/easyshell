import type { ProblemConfig } from "@easyshell/problems/schema"
import { getFs, PROBLEMS_DIR } from "@easyshell/utils/build"

const SLUG = "zip-peek"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  // backup.zip holds exactly the files in fixtures/<id> (see generate.sh).
  // Names are ASCII, so the default sort matches `sort` in the container.
  const files = Object.keys(
    await getFs(`${PROBLEMS_DIR}/${SLUG}/fixtures/${id}`),
  ).toSorted()

  return {
    id: id,
    public: isPublic,
    expected_stdout: files.join("\n"),
  }
}

const config: ProblemConfig = {
  id: 60,
  slug: SLUG,
  title: "Zip Peek",
  description: `The intern swears the database backup is in that zip. Look before you leap. 👀`,
  difficulty: "medium",
  tags: ["unzip", "awk", "sort"],
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
      input: `unzip -Z1 backup.zip | grep -v '/$' | sort`,
    },
    {
      testcase: "all",
      pass: true,
      input: `unzip -l backup.zip | awk '/^---------/ { n++; next } n == 1 && !/\\/$/ { print substr($0, 31) }' | sort`,
    },
    {
      testcase: "all",
      pass: true,
      input: `zipinfo -1 backup.zip > /tmp/list.txt\ngrep -v '/$' /tmp/list.txt | sort`,
    },
    {
      testcase: "all",
      pass: false,
      input: `unzip -o -q backup.zip && find . -type f | sed 's|^\\./||' | sort`,
    },
    {
      testcase: [2, 3],
      pass: false,
      input: `unzip -Z1 backup.zip | sort`,
    },
    {
      testcase: "all",
      pass: false,
      input: `unzip -Z1 backup.zip | grep -v '/$'`,
    },
    {
      testcase: [3],
      pass: false,
      input: `unzip -l backup.zip | sed '1,3d' | sed '$d' | sed '$d' | awk '{ print $4 }' | grep -v '/$' | sort`,
    },
    {
      testcase: [3, 4],
      pass: false,
      input: `unzip -l backup.zip | sed '1,3d' | sed '$d' | sed '$d' | awk '$1 > 0' | cut -c31- | sort`,
    },
  ],
}

export default config
