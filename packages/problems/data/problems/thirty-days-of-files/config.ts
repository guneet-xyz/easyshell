import type { ProblemConfig } from "@easyshell/problems/schema"
import { getFs, testcaseDir } from "@easyshell/utils/build"

const SLUG = "thirty-days-of-files"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const originalFs = await getFs(testcaseDir(SLUG, id))
  const days = parseInt(originalFs["days.txt"]!, 10)

  const journal: Record<string, string> = {}
  for (let day = 1; day <= days; day++) {
    const file = `journal/day-${day.toString().padStart(2, "0")}.txt`
    journal[file] = `Day ${day}: TODO\n`
  }

  return {
    id: id,
    public: isPublic,
    expected_fs: { ...originalFs, ...journal },
  }
}

const config: ProblemConfig = {
  id: 36,
  slug: SLUG,
  title: "Thirty Days of Files",
  description: `You promised to journal every day this month. Pre-create the guilt. 📅`,
  difficulty: "medium",
  tags: ["for", "seq", "printf"],
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
      input: `mkdir -p journal; for i in $(seq 1 $(cat days.txt)); do echo "Day $i: TODO" > journal/$(printf 'day-%02d.txt' $i); done`,
    },
    {
      testcase: "all",
      pass: true,
      input: `n=$(cat days.txt)
i=1
mkdir -p journal
while [ "$i" -le "$n" ]; do
  printf 'Day %d: TODO\\n' "$i" > "$(printf 'journal/day-%02d.txt' "$i")"
  i=$((i + 1))
done`,
    },
    {
      testcase: "all",
      pass: true,
      input: `mkdir -p journal\nawk -v n="$(cat days.txt)" 'BEGIN { for (i = 1; i <= n; i++) { f = sprintf("journal/day-%02d.txt", i); printf "Day %d: TODO\\n", i > f; close(f) } }'`,
    },
    {
      testcase: "all",
      pass: false,
      input: `mkdir -p journal; for i in $(seq 1 $(cat days.txt)); do echo "Day $i: TODO" > journal/day-$i.txt; done`,
    },
    {
      testcase: "all",
      pass: false,
      input: `mkdir -p journal; for i in $(seq -w 1 $(cat days.txt)); do echo "Day $i: TODO" > journal/day-$i.txt; done`,
    },
    {
      testcase: [2, 3, 4],
      pass: false,
      input: `mkdir -p journal; for i in $(seq 1 30); do echo "Day $i: TODO" > journal/$(printf 'day-%02d.txt' $i); done`,
    },
  ],
}

export default config
